"use client";

import { authFetch } from "@/lib/supabase/fetch-with-session";

import type { ChatModelOption } from "@/lib/types/chat-models";
import type { ChatMessageRow, ChatSummary } from "@/lib/types/chat";

export type { ChatMessageRow, ChatSummary, ChatModelOption };

export async function fetchChats(): Promise<{ chats: ChatSummary[] }> {
  const res = await authFetch("/api/chats");
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Failed to load chats");
  }
  return j as { chats: ChatSummary[] };
}

export async function fetchMessages(
  chatId: string
): Promise<{ messages: ChatMessageRow[] }> {
  const res = await authFetch(`/api/chats/${chatId}/messages`);
  const j = await res.json().catch(() => ({}));
  if (res.status === 404) {
    throw new Error("CHAT_NOT_FOUND");
  }
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Failed to load messages");
  }
  return j as { messages: ChatMessageRow[] };
}

export async function createChat(title?: string): Promise<{ id: string }> {
  const res = await authFetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title?.trim() || "New chat" })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Failed to create chat");
  }
  return j as { id: string };
}

export async function deleteChat(chatId: string): Promise<void> {
  const res = await authFetch(`/api/chats/${chatId}`, { method: "DELETE" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Failed to delete chat");
  }
}

export async function fetchChatModels(): Promise<{ models: ChatModelOption[] }> {
  const res = await authFetch("/api/chat-models");
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Failed to load models");
  }
  return j as { models: ChatModelOption[] };
}

export async function uploadDocument(
  file: File,
  chatId: string
): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("chatId", chatId);
  const res = await authFetch("/api/documents", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Upload failed");
  }
  return j as { id: string };
}

export async function uploadChatImage(
  file: File,
  chatId: string
): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authFetch(`/api/chats/${chatId}/attachments`, {
    method: "POST",
    body: fd
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Image upload failed");
  }
  return j as { id: string };
}
