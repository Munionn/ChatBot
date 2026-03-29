import { NextResponse } from "next/server";

import { sendMessageBodySchema } from "@/lib/api/schemas";
import { getAnonSessionIdFromUser, isGuestUser } from "@/lib/auth/session-context";
import { GUEST_MESSAGE_QUOTA } from "@/lib/constants/chat";
import { attachSignedImageUrls } from "@/lib/chat-images/message-image-urls";
import { loadPendingImageDataUrls } from "@/lib/chat-images/load-pending-images";
import { DOCUMENT_CONTEXT_MAX_CHARS } from "@/lib/constants/documents";
import { selectChunksForPrompt } from "@/lib/documents/retrieval";
import type { ChunkRow } from "@/lib/types/documents";
import { verifyDocumentsForChatMessage } from "@/lib/documents/verify-for-message";
import { resolveAllowedChatModel } from "@/lib/llm/allowed-models";
import type { ContextDoc } from "@/lib/types/llm";
import { getHuggingFaceClient } from "@/lib/llm/huggingface";
import { streamChat } from "@/lib/llm/stream-chat";
import { parseGuestConsumeResult, parseGuestRemainingScalar } from "@/lib/guest-quota";
import { getRouteUser } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ chatId: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

type SSEPayload =
  | { type: "user_message"; id: string }
  | { type: "delta"; text: string }
  | { type: "done"; assistant_message_id: string; remaining?: number }
  | { type: "error"; message: string };

function encodeSSE(payload: SSEPayload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id,role,content,status,created_at,model")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const messages = await attachSignedImageUrls(supabase, rows);

  return NextResponse.json({ messages });
}

export async function POST(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = sendMessageBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const content = parsed.data.content.trim();
  const guest = isGuestUser(user);
  const anonId = getAnonSessionIdFromUser(user);

  const { data: chat, error: chatErr } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .maybeSingle();

  if (chatErr || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  let model: string;
  try {
    model = resolveAllowedChatModel(parsed.data.model);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid model" },
      { status: 400 }
    );
  }

  try {
    getHuggingFaceClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Hugging Face not configured" },
      { status: 503 }
    );
  }

  if (guest) {
    const { data: remRaw, error: remErr } = await supabase.rpc(
      "get_guest_remaining_questions",
      { max_questions: GUEST_MESSAGE_QUOTA }
    );
    if (remErr) {
      return NextResponse.json({ error: remErr.message }, { status: 500 });
    }
    const remainingStart = parseGuestRemainingScalar(remRaw);
    if (remainingStart === null || remainingStart <= 0) {
      return NextResponse.json(
        {
          error: "Guest message limit reached",
          remaining: remainingStart ?? 0
        },
        { status: 429 }
      );
    }
  }

  let contextDocsForStream: ContextDoc[] | undefined;
  const requestedDocIds = parsed.data.documentIds;
  if (requestedDocIds && requestedDocIds.length > 0) {
    const verified = await verifyDocumentsForChatMessage(
      supabase,
      requestedDocIds,
      chatId
    );
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.error },
        { status: verified.status }
      );
    }
    if (verified.ids.length > 0) {
      const { data: chunkRows, error: crErr } = await supabase
        .from("document_chunks")
        .select("content, chunk_index, document_id, documents!inner(name)")
        .in("document_id", verified.ids)
        .order("document_id", { ascending: true })
        .order("chunk_index", { ascending: true });

      if (crErr) {
        return NextResponse.json({ error: crErr.message }, { status: 500 });
      }

      const rows: ChunkRow[] = (chunkRows ?? []).map((r) => {
        const rel = r.documents as { name: string } | { name: string }[];
        const doc = Array.isArray(rel) ? rel[0] : rel;
        return { content: r.content, documentName: doc?.name ?? "Document" };
      });

      const picked = selectChunksForPrompt(
        rows,
        content,
        DOCUMENT_CONTEXT_MAX_CHARS
      );
      contextDocsForStream =
        picked.length > 0 ? picked : undefined;
    }
  }

  const attachmentIdsForLink = parsed.data.attachmentIds;
  let lastUserImageDataUrls: string[] | undefined;
  if (attachmentIdsForLink && attachmentIdsForLink.length > 0) {
    const loaded = await loadPendingImageDataUrls(
      supabase,
      attachmentIdsForLink,
      chatId
    );
    if (!loaded.ok) {
      return NextResponse.json(
        { error: loaded.error },
        { status: loaded.status }
      );
    }
    lastUserImageDataUrls =
      loaded.dataUrls.length > 0 ? loaded.dataUrls : undefined;
  }

  const { data: userMsg, error: userInsertErr } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      user_id: guest ? null : user.id,
      anon_session_id: guest ? anonId : null,
      role: "user",
      content,
      status: "complete",
      model
    })
    .select("id")
    .single();

  if (userInsertErr || !userMsg) {
    return NextResponse.json(
      { error: userInsertErr?.message ?? "Failed to save user message" },
      { status: 500 }
    );
  }

  if (attachmentIdsForLink && attachmentIdsForLink.length > 0) {
    const { error: linkErr } = await supabase
      .from("attachments")
      .update({ message_id: userMsg.id })
      .in("id", attachmentIdsForLink);
    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role,content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(40);

  const chatMessages = (history ?? [])
    .filter(
      (m) =>
        m.role === "user" || m.role === "assistant" || m.role === "system"
    )
    .map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content
    }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: SSEPayload) => {
        controller.enqueue(encoder.encode(encodeSSE(payload)));
      };

      send({ type: "user_message", id: userMsg.id });

      let fullAssistant = "";

      try {
        for await (const delta of streamChat({
          model,
          messages: chatMessages,
          contextDocs: contextDocsForStream,
          lastUserImageDataUrls
        })) {
          fullAssistant += delta;
          send({ type: "delta", text: delta });
        }

        const { data: assistantRow, error: assistErr } = await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            user_id: guest ? null : user.id,
            anon_session_id: guest ? anonId : null,
            role: "assistant",
            content: fullAssistant,
            status: "complete",
            model
          })
          .select("id")
          .single();

        if (assistErr || !assistantRow) {
          send({
            type: "error",
            message: assistErr?.message ?? "Failed to save assistant message"
          });
          controller.close();
          return;
        }

        await supabase
          .from("chats")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", chatId);

        let remaining: number | undefined;
        if (guest) {
          const { data: consumeRaw, error: consumeErr } = await supabase.rpc(
            "consume_guest_message",
            { max_questions: GUEST_MESSAGE_QUOTA }
          );
          if (!consumeErr && consumeRaw != null) {
            const { remaining: remAfter } = parseGuestConsumeResult(consumeRaw);
            remaining = remAfter;
          } else {
            const { data: remRaw } = await supabase.rpc(
              "get_guest_remaining_questions",
              { max_questions: GUEST_MESSAGE_QUOTA }
            );
            const r = parseGuestRemainingScalar(remRaw);
            if (r !== null) remaining = r;
          }
        }

        send({
          type: "done",
          assistant_message_id: assistantRow.id,
          remaining
        });
        controller.close();
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "Stream failed"
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
