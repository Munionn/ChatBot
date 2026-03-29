"use client";

import { useEffect, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import type { QueryClient } from "@tanstack/react-query";

import type { ChatMessageRow, ChatSummary } from "@/lib/types/chat";
import { chatKeys, messageKeys } from "@/lib/chat/query-keys";
import {
  rowToChatSummary,
  rowToMessage,
  sortChatsDesc,
  sortMessagesAsc
} from "@/lib/chat/realtime";
import { deferRouterAction } from "@/lib/next/defer-router-action";
import { supabaseBrowser } from "@/lib/supabase/browser";

type PostgresChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

function isPostgresPayload(p: unknown): p is PostgresChangePayload {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    o.eventType === "INSERT" ||
    o.eventType === "UPDATE" ||
    o.eventType === "DELETE"
  );
}

type UseChatRealtimeOptions = {
  enabled: boolean;
  queryClient: QueryClient;
  activeChatId: string | null;
  streamTargetRef: MutableRefObject<{ chatId: string } | null>;
};

export function useChatRealtime({
  enabled,
  queryClient,
  activeChatId,
  streamTargetRef
}: UseChatRealtimeOptions) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const qc = queryClient;

    const applyChats = (payload: PostgresChangePayload) => {
      if (payload.eventType === "INSERT" && payload.new) {
        const row = rowToChatSummary(payload.new);
        qc.setQueryData<{ chats: ChatSummary[] }>(chatKeys.list(), (old) => {
          const list = old?.chats ?? [];
          if (list.some((c) => c.id === row.id)) return old;
          return { chats: [row, ...list].sort(sortChatsDesc) };
        });
        return;
      }

      if (payload.eventType === "UPDATE" && payload.new) {
        const row = rowToChatSummary(payload.new);
        qc.setQueryData<{ chats: ChatSummary[] }>(chatKeys.list(), (old) => {
          const list = old?.chats ?? [];
          const idx = list.findIndex((c) => c.id === row.id);
          if (idx < 0) {
            return { chats: [row, ...list].sort(sortChatsDesc) };
          }
          const next = [...list];
          next[idx] = row;
          return { chats: next.sort(sortChatsDesc) };
        });
        return;
      }

      if (payload.eventType === "DELETE" && payload.old?.id) {
        const deletedId = String(payload.old.id);
        qc.setQueryData<{ chats: ChatSummary[] }>(chatKeys.list(), (old) => {
          if (!old?.chats) return old;
          return {
            chats: old.chats.filter((c) => c.id !== deletedId)
          };
        });
        qc.removeQueries({ queryKey: messageKeys.byChat(deletedId) });
        if (activeChatId === deletedId) {
          deferRouterAction(() => router.replace("/chat"));
        }
      }
    };

    const chatIdFromRow = (row: Record<string, unknown> | null) =>
      row?.chat_id != null ? String(row.chat_id) : null;

    const applyMessages = (payload: PostgresChangePayload) => {
      if (payload.eventType === "INSERT" && payload.new) {
        const raw = payload.new;
        const cid = chatIdFromRow(raw);
        if (!cid) return;

        const mapped = rowToMessage(raw);
        const guard = streamTargetRef.current;
        if (mapped.role === "assistant" && guard?.chatId === cid) {
          return;
        }

        const key = messageKeys.byChat(cid);
        qc.setQueryData<{ messages: ChatMessageRow[] }>(key, (old) => {
          let msgs = old?.messages ?? [];
          if (msgs.some((m) => m.id === mapped.id)) {
            return old;
          }
          if (mapped.role === "user") {
            msgs = msgs.filter(
              (m) =>
                !(
                  m.id.startsWith("optimistic-") &&
                  m.role === "user" &&
                  m.content === mapped.content
                )
            );
          }
          msgs = [...msgs, mapped].sort(sortMessagesAsc);
          return { messages: msgs };
        });

        qc.setQueryData<{ chats: ChatSummary[] }>(chatKeys.list(), (old) => {
          if (!old?.chats?.length) return old;
          const t = mapped.created_at;
          return {
            chats: old.chats.map((c) =>
              c.id === cid ? { ...c, last_message_at: t, updated_at: t } : c
            )
          };
        });

        if (mapped.role === "user") {
          void qc.invalidateQueries({ queryKey: messageKeys.byChat(cid) });
        }
        return;
      }

      if (payload.eventType === "UPDATE" && payload.new) {
        const raw = payload.new;
        const cid = chatIdFromRow(raw);
        if (!cid) return;
        const mapped = rowToMessage(raw);
        const key = messageKeys.byChat(cid);
        qc.setQueryData<{ messages: ChatMessageRow[] }>(key, (old) => {
          const msgs = old?.messages ?? [];
          const idx = msgs.findIndex((m) => m.id === mapped.id);
          if (idx < 0) {
            return { messages: [...msgs, mapped].sort(sortMessagesAsc) };
          }
          const next = [...msgs];
          next[idx] = mapped;
          return { messages: next.sort(sortMessagesAsc) };
        });
        return;
      }

      if (payload.eventType === "DELETE" && payload.old?.id) {
        const mid = String(payload.old.id);
        const cid =
          payload.old.chat_id != null ? String(payload.old.chat_id) : null;
        if (cid) {
          const key = messageKeys.byChat(cid);
          qc.setQueryData<{ messages: ChatMessageRow[] }>(key, (old) => {
            if (!old?.messages) return old;
            return {
              messages: old.messages.filter((m) => m.id !== mid)
            };
          });
        } else {
          void qc.invalidateQueries({ queryKey: messageKeys.all });
        }
      }
    };

    const channel = supabaseBrowser
      .channel("realtime:chats-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        (payload) => {
          if (isPostgresPayload(payload)) applyChats(payload);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (isPostgresPayload(payload)) applyMessages(payload);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "[realtime] CHANNEL_ERROR — usually invalid/missing JWT (fix 401s: same-project NEXT_PUBLIC_SUPABASE_ANON_KEY + URL) or add tables to supabase_realtime publication; see README Phase 7"
          );
        }
      });

    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [enabled, queryClient, router, streamTargetRef, activeChatId]);
}

