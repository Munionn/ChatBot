import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function verifyDocumentsForChatMessage(
  supabase: SupabaseClient,
  documentIds: string[],
  chatId: string
): Promise<
  | { ok: true; ids: string[] }
  | { ok: false; status: number; error: string }
> {
  const unique = [...new Set(documentIds)];
  if (unique.length === 0) {
    return { ok: true, ids: [] };
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, chat_id, status")
    .in("id", unique);

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data || data.length !== unique.length) {
    return {
      ok: false,
      status: 400,
      error: "One or more documents were not found or are not accessible."
    };
  }

  for (const d of data) {
    if (d.status !== "ready") {
      return {
        ok: false,
        status: 400,
        error: "A document is still processing or failed. Try again in a moment."
      };
    }
    if (d.chat_id != null && d.chat_id !== chatId) {
      return {
        ok: false,
        status: 400,
        error: "A document is not attached to this chat."
      };
    }
  }

  return { ok: true, ids: unique };
}
