import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHAT_IMAGES_BUCKET,
  CHAT_IMAGE_SIGNED_URL_TTL_SEC
} from "@/lib/constants/chat-images";
import type {
  ChatMessageRowForImageSigning,
  MessageWithImages
} from "@/lib/types/chat-images";

export type { MessageWithImages } from "@/lib/types/chat-images";

export async function attachSignedImageUrls(
  supabase: SupabaseClient,
  messages: ChatMessageRowForImageSigning[]
): Promise<MessageWithImages[]> {
  if (messages.length === 0) return [];

  const ids = messages.map((m) => m.id);
  const { data: atts, error } = await supabase
    .from("attachments")
    .select("message_id, path")
    .in("message_id", ids)
    .eq("kind", "image")
    .order("created_at", { ascending: true });

  if (error || !atts?.length) {
    return messages;
  }

  const pathsByMessage = new Map<string, string[]>();
  for (const a of atts) {
    const mid = a.message_id as string | null;
    const path = a.path as string | null;
    if (!mid || !path) continue;
    const list = pathsByMessage.get(mid) ?? [];
    list.push(path);
    pathsByMessage.set(mid, list);
  }

  const urlCache = new Map<string, string>();
  const resolveUrl = async (path: string): Promise<string | null> => {
    const hit = urlCache.get(path);
    if (hit) return hit;
    const { data, error: signErr } = await supabase.storage
      .from(CHAT_IMAGES_BUCKET)
      .createSignedUrl(path, CHAT_IMAGE_SIGNED_URL_TTL_SEC);
    if (signErr || !data?.signedUrl) return null;
    urlCache.set(path, data.signedUrl);
    return data.signedUrl;
  };

  const out: MessageWithImages[] = [];
  for (const m of messages) {
    const paths = pathsByMessage.get(m.id);
    if (!paths?.length) {
      out.push(m);
      continue;
    }
    const urls: string[] = [];
    for (const p of paths) {
      const u = await resolveUrl(p);
      if (u) urls.push(u);
    }
    out.push(urls.length > 0 ? { ...m, imageUrls: urls } : m);
  }
  return out;
}
