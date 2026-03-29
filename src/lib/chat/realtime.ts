import type { ChatMessageRow, ChatSummary } from "./api";

export function rowToChatSummary(row: Record<string, unknown>): ChatSummary {
  return {
    id: String(row.id),
    title: row.title != null ? String(row.title) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    last_message_at:
      row.last_message_at != null ? String(row.last_message_at) : null
  };
}

export function rowToMessage(row: Record<string, unknown>): ChatMessageRow {
  return {
    id: String(row.id),
    role: String(row.role),
    content: String(row.content),
    created_at: String(row.created_at),
    model: row.model != null ? String(row.model) : null
  };
}

export function sortChatsDesc(a: ChatSummary, b: ChatSummary): number {
  return (
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function sortMessagesAsc(a: ChatMessageRow, b: ChatMessageRow): number {
  return (
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
