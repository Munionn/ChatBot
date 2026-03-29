import { NextResponse } from "next/server";
import { z } from "zod";

import { getAnonSessionIdFromUser, isGuestUser } from "@/lib/auth/session-context";
import { chunkText } from "@/lib/documents/chunk-text";
import {
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_BUCKET,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MAX_CHUNKS
} from "@/lib/constants/documents";
import { extractDocumentText } from "@/lib/documents/extract-text";
import { inferMimeFromFilename } from "@/lib/documents/file-meta";
import { sanitizeFilename } from "@/lib/documents/sanitize-filename";
import { getRouteUser } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const listQuerySchema = z.object({
  chatId: z.string().uuid().optional()
});

function resolveMime(file: File, safeName: string): string | null {
  const raw = file.type?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (raw && DOCUMENT_ALLOWED_MIME.has(raw)) return raw;
  return inferMimeFromFilename(safeName);
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    chatId: url.searchParams.get("chatId") || undefined
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let q = supabase
    .from("documents")
    .select("id,name,status,chunk_count,chat_id,created_at")
    .order("created_at", { ascending: false });

  if (parsed.data.chatId) {
    q = q.eq("chat_id", parsed.data.chatId);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guest = isGuestUser(user);
  const anonId = getAnonSessionIdFromUser(user);
  if (guest && !anonId) {
    return NextResponse.json(
      { error: "Guest session is missing anon id; refresh and try again." },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing or empty file" }, { status: 400 });
  }

  if (file.size > DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${DOCUMENT_MAX_BYTES} bytes)` },
      { status: 400 }
    );
  }

  const chatIdRaw = form.get("chatId");
  let chatId: string | null = null;
  if (typeof chatIdRaw === "string" && chatIdRaw.trim()) {
    const cid = z.string().uuid().safeParse(chatIdRaw.trim());
    if (!cid.success) {
      return NextResponse.json({ error: "Invalid chatId" }, { status: 400 });
    }
    chatId = cid.data;
    const { data: ch, error: chErr } = await supabase
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .maybeSingle();
    if (chErr || !ch) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
  }

  const safeName = sanitizeFilename(file.name);
  const mime = resolveMime(file, safeName);
  if (!mime) {
    return NextResponse.json(
      { error: "Unsupported file type. Use .txt, .md, or .pdf." },
      { status: 400 }
    );
  }

  const docId = crypto.randomUUID();
  const storagePath = `${user.id}/${docId}/${safeName}`;

  const { error: insErr } = await supabase.from("documents").insert({
    id: docId,
    user_id: guest ? null : user.id,
    anon_session_id: guest ? anonId : null,
    chat_id: chatId,
    name: file.name,
    path: storagePath,
    status: "processing",
    chunk_count: 0
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: false
    });

  if (upErr) {
    await supabase.from("documents").delete().eq("id", docId);
    return NextResponse.json(
      { error: upErr.message ?? "Storage upload failed" },
      { status: 500 }
    );
  }

  try {
    let text = await extractDocumentText(buffer, mime);
    if (!text) {
      text = "[No extractable text in this file.]";
    }

    let pieces = chunkText(text);
    if (pieces.length === 0) {
      pieces = [text.slice(0, DOCUMENT_MAX_BYTES)];
    }
    if (pieces.length > DOCUMENT_MAX_CHUNKS) {
      pieces = pieces.slice(0, DOCUMENT_MAX_CHUNKS);
    }

    const rows = pieces.map((content, chunk_index) => ({
      document_id: docId,
      chunk_index,
      content
    }));

    for (let i = 0; i < rows.length; i += 80) {
      const batch = rows.slice(i, i + 80);
      const { error: chErr } = await supabase.from("document_chunks").insert(batch);
      if (chErr) {
        throw new Error(chErr.message);
      }
    }

    const { error: finErr } = await supabase
      .from("documents")
      .update({
        status: "ready",
        chunk_count: rows.length
      })
      .eq("id", docId);

    if (finErr) {
      throw new Error(finErr.message);
    }

    return NextResponse.json({
      id: docId,
      status: "ready",
      chunk_count: rows.length
    });
  } catch (e) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]).catch(() => {});
    await supabase.from("documents").delete().eq("id", docId);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Document processing failed"
      },
      { status: 500 }
    );
  }
}
