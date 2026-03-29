import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CHAT_IMAGES_BUCKET } from "@/lib/constants/chat-images";

export async function loadPendingImageDataUrls(
  supabase: SupabaseClient,
  attachmentIds: string[],
  chatId: string
): Promise<
  | { ok: true; dataUrls: string[] }
  | { ok: false; status: number; error: string }
> {
  const orderedUnique: string[] = [];
  const seen = new Set<string>();
  for (const id of attachmentIds) {
    if (!seen.has(id)) {
      seen.add(id);
      orderedUnique.push(id);
    }
  }
  if (orderedUnique.length === 0) {
    return { ok: true, dataUrls: [] };
  }

  const { data, error } = await supabase
    .from("attachments")
    .select("id, path, mime_type, kind, message_id, chat_id")
    .in("id", orderedUnique)
    .eq("chat_id", chatId);

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data || data.length !== orderedUnique.length) {
    return {
      ok: false,
      status: 400,
      error: "One or more images were not found or are not accessible."
    };
  }

  for (const row of data) {
    if (row.kind !== "image") {
      return {
        ok: false,
        status: 400,
        error: "Only image attachments can be sent with a message."
      };
    }
    if (row.message_id != null) {
      return {
        ok: false,
        status: 400,
        error: "An image was already used in another message."
      };
    }
  }

  const byId = new Map(data.map((r) => [r.id, r]));
  const dataUrls: string[] = [];

  for (const id of orderedUnique) {
    const row = byId.get(id);
    if (!row) {
      return { ok: false, status: 400, error: "Missing attachment row." };
    }
    const { data: file, error: dlErr } = await supabase.storage
      .from(CHAT_IMAGES_BUCKET)
      .download(row.path);

    if (dlErr || !file) {
      return {
        ok: false,
        status: 500,
        error: dlErr?.message ?? "Failed to read image from storage."
      };
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime =
      row.mime_type?.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
    dataUrls.push(`data:${mime};base64,${buf.toString("base64")}`);
  }

  return { ok: true, dataUrls };
}
