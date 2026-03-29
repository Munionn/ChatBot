import { NextResponse } from "next/server";

import { getAnonSessionIdFromUser, isGuestUser } from "@/lib/auth/session-context";
import {
  CHAT_IMAGE_ALLOWED_MIME,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_IMAGES_BUCKET
} from "@/lib/constants/chat-images";
import { sanitizeFilename } from "@/lib/documents/sanitize-filename";
import { getRouteUser } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ chatId: string }> };

function resolveImageMime(typeHint: string, safeName: string): string | null {
  const raw = typeHint?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (raw && CHAT_IMAGE_ALLOWED_MIME.has(raw)) return raw;
  const n = safeName.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  return null;
}

function isBlobLike(v: unknown): v is Blob {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Blob).arrayBuffer === "function" &&
    typeof (v as Blob).size === "number"
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
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

  const { data: chat, error: chatErr } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .maybeSingle();

  if (chatErr || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const rawFile = form.get("file");
  if (!isBlobLike(rawFile) || rawFile.size === 0) {
    return NextResponse.json({ error: "Missing or empty file" }, { status: 400 });
  }

  if (rawFile.size > CHAT_IMAGE_MAX_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${CHAT_IMAGE_MAX_BYTES} bytes)` },
      { status: 400 }
    );
  }

  const displayName =
    typeof File !== "undefined" && rawFile instanceof File && rawFile.name
      ? rawFile.name
      : "image";
  const typeHint =
    typeof File !== "undefined" && rawFile instanceof File
      ? rawFile.type
      : rawFile.type ?? "";

  const safeName = sanitizeFilename(displayName);
  const mime = resolveImageMime(typeHint, safeName);
  if (!mime) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG, PNG, GIF, or WebP." },
      { status: 400 }
    );
  }

  const storageMime =
    mime === "image/pjpeg" || mime === "image/jpg"
      ? "image/jpeg"
      : mime === "image/x-png"
        ? "image/png"
        : mime;

  const attachmentId = crypto.randomUUID();
  const storagePath = `${user.id}/${chatId}/${attachmentId}/${safeName}`;

  const buffer = Buffer.from(await rawFile.arrayBuffer());

  const { error: insErr } = await supabase.from("attachments").insert({
    id: attachmentId,
    chat_id: chatId,
    message_id: null,
    user_id: guest ? null : user.id,
    anon_session_id: guest ? anonId : null,
    kind: "image",
    path: storagePath,
    mime_type: storageMime,
    size_bytes: buffer.length,
    meta_json: {}
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const { error: upErr } = await supabase.storage
    .from(CHAT_IMAGES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: storageMime,
      upsert: false
    });

  if (upErr) {
    await supabase.from("attachments").delete().eq("id", attachmentId);
    return NextResponse.json(
      { error: upErr.message ?? "Storage upload failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: attachmentId });
}