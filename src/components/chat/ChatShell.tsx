"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createChat,
  deleteChat,
  fetchChatModels,
  fetchChats,
  fetchMessages,
  uploadChatImage,
  uploadDocument,
  type ChatMessageRow
} from "@/lib/chat/api";
import {
  CHAT_IMAGE_MAX_PER_MESSAGE,
  isChatImageFileAllowed
} from "@/lib/constants/chat-images";
import { isDocumentFileAllowed } from "@/lib/documents/file-meta";
import { chatKeys, messageKeys } from "@/lib/chat/query-keys";
import { deferRouterAction } from "@/lib/next/defer-router-action";
import { authFetch } from "@/lib/supabase/fetch-with-session";

import { ChatComposerBar } from "./ChatComposerBar";
import type { LocalDocPreview, LocalImagePreview } from "./ChatComposerBar";
import { ChatSidebar, ChatSidebarMobileToggle } from "./ChatSidebar";
import { ChatThread } from "./ChatThread";
import { useChatRealtime } from "@/hooks/use-chat-realtime";

import { useChatSession } from "./chat-session-context";

type SendState = "idle" | "sending" | "blocked" | "error";

type LastSendPayload = {
  chatId: string;
  content: string;
  model: string | null;
};

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (t: string) => void,
  onDoneRemaining: (n: number | undefined) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data: ")) continue;
      let payload: {
        type: string;
        text?: string;
        remaining?: number;
        message?: string;
      };
      try {
        payload = JSON.parse(line.slice(6)) as typeof payload;
      } catch {
        continue;
      }
      if (payload.type === "delta" && payload.text) onDelta(payload.text);
      if (payload.type === "done") onDoneRemaining(payload.remaining);
      if (payload.type === "error") {
        throw new Error(payload.message ?? "Stream error");
      }
    }
  }
}

export default function ChatShell() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const {
    sessionUser,
    isGuest,
    isBootstrapping,
    remaining,
    refreshRemaining,
    signOut
  } = useChatSession();

  const chatId =
    typeof params.chatId === "string" && params.chatId.length > 0
      ? params.chatId
      : null;

  const [routingChatId, setRoutingChatId] = useState<string | null>(null);
  const effectiveChatId = chatId ?? routingChatId;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [images, setImages] = useState<LocalImagePreview[]>([]);
  const [docs, setDocs] = useState<LocalDocPreview[]>([]);
  const lastSendRef = useRef<LastSendPayload | null>(null);
  const streamTargetRef = useRef<{ chatId: string } | null>(null);

  const sessionReady = !!sessionUser && !isBootstrapping;

  useChatRealtime({
    enabled: sessionReady,
    queryClient: qc,
    activeChatId: effectiveChatId,
    streamTargetRef
  });

  const chatsQuery = useQuery({
    queryKey: chatKeys.list(),
    queryFn: fetchChats,
    enabled: sessionReady
  });

  const messagesQuery = useQuery({
    queryKey: effectiveChatId
      ? messageKeys.byChat(effectiveChatId)
      : ["messages", "idle"],
    queryFn: () => fetchMessages(effectiveChatId!),
    enabled: sessionReady && !!effectiveChatId
  });

  const modelsQuery = useQuery({
    queryKey: ["chat-models"],
    queryFn: fetchChatModels,
    enabled: sessionReady
  });

  const chatModels = useMemo(
    () => modelsQuery.data?.models ?? [],
    [modelsQuery.data]
  );

  useEffect(() => {
    if (chatModels.length && selectedModelId === null) {
      setSelectedModelId(chatModels[0].id);
    }
  }, [chatModels, selectedModelId]);

  useEffect(() => {
    if (pathname !== "/chat") return;
    if (!chatsQuery.isSuccess) return;
    const list = chatsQuery.data?.chats ?? [];
    if (list.length === 0) return;
    deferRouterAction(() => router.replace(`/chat/${list[0].id}`));
  }, [pathname, chatsQuery.isSuccess, chatsQuery.data, router]);

  useEffect(() => {
    const err = messagesQuery.error;
    if (!err || !(err instanceof Error)) return;
    if (err.message !== "CHAT_NOT_FOUND") return;
    toast.error("Chat not found.");
    deferRouterAction(() => router.replace("/chat"));
  }, [messagesQuery.error, router]);

  useEffect(() => {
    if (!sessionReady || !chatId) return;
    if (!chatsQuery.isSuccess || chatsQuery.isFetching) return;
    if (routingChatId === chatId) return;

    const list = chatsQuery.data?.chats ?? [];
    if (list.some((c) => c.id === chatId)) return;

    qc.removeQueries({ queryKey: messageKeys.byChat(chatId) });
    setRoutingChatId(null);
    deferRouterAction(() => router.replace("/chat"));
    toast.message("Chat unavailable", {
      description:
        "This conversation is not available for your session. Starting fresh."
    });
  }, [
    sessionReady,
    chatId,
    routingChatId,
    chatsQuery.isSuccess,
    chatsQuery.isFetching,
    chatsQuery.data,
    router,
    qc
  ]);

  useEffect(() => {
    if (!chatsQuery.error) return;
    toast.error(
      chatsQuery.error instanceof Error
        ? chatsQuery.error.message
        : "Failed to load chats"
    );
  }, [chatsQuery.error]);

  useEffect(() => {
    if (!messagesQuery.isError || !messagesQuery.error) return;
    const e = messagesQuery.error;
    if (e instanceof Error && e.message === "CHAT_NOT_FOUND") return;
    toast.error(e instanceof Error ? e.message : "Failed to load messages");
  }, [messagesQuery.isError, messagesQuery.error]);

  const newChatMutation = useMutation({
    mutationFn: () => createChat("New chat"),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: chatKeys.list() });
      deferRouterAction(() => router.push(`/chat/${data.id}`));
      setSidebarOpen(false);
      toast.success("New chat created");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not create chat")
  });

  const deleteChatMutation = useMutation({
    mutationFn: deleteChat,
    onSuccess: (_, deletedId) => {
      void qc.invalidateQueries({ queryKey: chatKeys.list() });
      void qc.removeQueries({ queryKey: messageKeys.byChat(deletedId) });
      if (chatId === deletedId) {
        deferRouterAction(() => router.push("/chat"));
      }
      toast.success("Chat deleted");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete chat")
  });

  const messages = useMemo(
    () => messagesQuery.data?.messages ?? [],
    [messagesQuery.data]
  );

  useEffect(() => {
    if (chatId && routingChatId && chatId === routingChatId) {
      setRoutingChatId(null);
    }
  }, [chatId, routingChatId]);

  useEffect(() => {
    if (routingChatId && chatId && chatId !== routingChatId) {
      setRoutingChatId(null);
    }
  }, [chatId, routingChatId]);

  const pickImages = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    setImages((p) => {
      const room = CHAT_IMAGE_MAX_PER_MESSAGE - p.length;
      if (room <= 0) {
        toast.error(
          `At most ${CHAT_IMAGE_MAX_PER_MESSAGE} images per message.`
        );
        return p;
      }
      const next: LocalImagePreview[] = [];
      for (let i = 0; i < files.length && next.length < room; i++) {
        const f = files[i];
        if (!isChatImageFileAllowed(f)) {
          toast.error(
            `${f.name || "Image"}: use JPEG, PNG, GIF, or WebP under 2 MB.`
          );
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          url: URL.createObjectURL(f),
          name: f.name,
          file: f
        });
      }
      if (next.length === 0) return p;
      if (files.length > room) {
        toast.message("Image limit", {
          description: `Only ${room} more image slot(s) available.`
        });
      }
      return [...p, ...next];
    });
  }, []);

  const pickDocs = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: LocalDocPreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!isDocumentFileAllowed(f)) {
        toast.error(`${f.name}: use .txt, .md, or .pdf under 5 MB.`);
        continue;
      }
      next.push({ id: crypto.randomUUID(), name: f.name, file: f });
    }
    if (next.length) setDocs((p) => [...p, ...next]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((p) => {
      const t = p.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return p.filter((x) => x.id !== id);
    });
  }, []);

  const removeDoc = useCallback((id: string) => {
    setDocs((p) => p.filter((x) => x.id !== id));
  }, []);

  const runSend = useCallback(
    async (content: string, explicitChatId: string | null) => {
      if (!sessionUser) return;
      let text = content.trim();
      const hasAttachments = images.length > 0 || docs.length > 0;
      if (!text && !hasAttachments) return;
      if (!text && hasAttachments) {
        const parts: string[] = [];
        if (images.length > 0) parts.push("image(s)");
        if (docs.length > 0) parts.push("document(s)");
        text = `Please use the attached ${parts.join(" and ")}.`;
      }

      let targetId = explicitChatId;
      if (!targetId) {
        const created = await createChat(text.slice(0, 50) || "New chat");
        targetId = created.id;
        setRoutingChatId(targetId);
        await qc.invalidateQueries({ queryKey: chatKeys.list() });
        deferRouterAction(() => router.push(`/chat/${targetId}`));
      }

      const documentIds: string[] = [];
      if (docs.length > 0) {
        for (const d of docs) {
          try {
            const { id } = await uploadDocument(d.file, targetId);
            documentIds.push(id);
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Document upload failed"
            );
            return;
          }
        }
      }

      const attachmentIds: string[] = [];
      if (images.length > 0) {
        if (images.length > CHAT_IMAGE_MAX_PER_MESSAGE) {
          toast.error(
            `At most ${CHAT_IMAGE_MAX_PER_MESSAGE} images per message.`
          );
          return;
        }
        for (const img of images) {
          try {
            const { id } = await uploadChatImage(img.file, targetId);
            attachmentIds.push(id);
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Image upload failed"
            );
            return;
          }
        }
      }

      const msgKey = messageKeys.byChat(targetId);
      await qc.cancelQueries({ queryKey: msgKey });
      const previous = qc.getQueryData<{ messages: ChatMessageRow[] }>(msgKey);
      const optimisticId = `optimistic-${Date.now()}`;
      qc.setQueryData(msgKey, (old: { messages: ChatMessageRow[] } | undefined) => ({
        messages: [
          ...(old?.messages ?? []),
          {
            id: optimisticId,
            role: "user",
            content: text,
            created_at: new Date().toISOString()
          }
        ]
      }));

      lastSendRef.current = {
        chatId: targetId,
        content: text,
        model: selectedModelId
      };

      setSendState("sending");
      setStreamingText("");
      setInput("");
      setImages((imgs) => {
        imgs.forEach((i) => URL.revokeObjectURL(i.url));
        return [];
      });
      setDocs([]);

      streamTargetRef.current = { chatId: targetId };
      try {
        const res = await authFetch(`/api/chats/${targetId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            ...(selectedModelId ? { model: selectedModelId } : {}),
            ...(documentIds.length > 0 ? { documentIds } : {}),
            ...(attachmentIds.length > 0 ? { attachmentIds } : {})
          })
        });

        if (res.status === 429) {
          const j = (await res.json().catch(() => ({}))) as {
            remaining?: number;
          };
          if (typeof j.remaining === "number") {
            toast.message("Guest limit reached", {
              description: `Remaining: ${j.remaining}`
            });
          }
          if (previous) qc.setQueryData(msgKey, previous);
          else qc.removeQueries({ queryKey: msgKey });
          setSendState("blocked");
          setStreamingText(null);
          await refreshRemaining();
          return;
        }

        if (res.status === 404) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          qc.removeQueries({ queryKey: msgKey });
          setStreamingText(null);
          setSendState("idle");
          setRoutingChatId(null);
          void qc.invalidateQueries({ queryKey: chatKeys.list() });
          deferRouterAction(() => router.replace("/chat"));
          toast.error(
            typeof j.error === "string"
              ? j.error
              : "Chat not found for this session."
          );
          return;
        }

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(
            typeof j.error === "string" ? j.error : res.statusText
          );
        }

        if (!res.body) throw new Error("No response body");

        await readSseStream(
          res.body,
          (t) => setStreamingText((prev) => (prev ?? "") + t),
          (rem) => {
            if (typeof rem === "number") void refreshRemaining();
          }
        );

        setStreamingText(null);
        setSendState("idle");
        await qc.invalidateQueries({ queryKey: msgKey });
        await qc.invalidateQueries({ queryKey: chatKeys.list() });
        await refreshRemaining();
      } catch (e) {
        if (previous) qc.setQueryData(msgKey, previous);
        else qc.removeQueries({ queryKey: msgKey });
        setStreamingText(null);
        setSendState("error");
        toast.error(e instanceof Error ? e.message : "Send failed");
      } finally {
        streamTargetRef.current = null;
      }
    },
    [sessionUser, images, docs, qc, router, selectedModelId, refreshRemaining]
  );

  const handleSend = useCallback(() => {
    void runSend(input, chatId);
  }, [input, chatId, runSend]);

  const handleRetry = useCallback(() => {
    const last = lastSendRef.current;
    if (!last) return;
    setInput(last.content);
    void runSend(last.content, last.chatId);
  }, [runSend]);

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--background)] text-slate-900 dark:text-slate-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <ChatSidebarMobileToggle onClick={() => setSidebarOpen(true)} />
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-900 p-1.5 text-white dark:bg-slate-700">
            <MessageSquareText className="size-4" />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {isGuest ? (
            <>
              <span className="text-slate-600 dark:text-slate-400">
                Guest:{" "}
                <strong className="text-slate-900 dark:text-slate-200">
                  {remaining === null ? "…" : remaining}
                </strong>
              </span>
              <Link
                href="/login"
                className="font-medium text-sky-600 underline dark:text-sky-400"
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              <span className="text-slate-600 dark:text-slate-400">Signed in</span>
              <button
                type="button"
                className="font-medium text-sky-600 underline dark:text-sky-400"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ChatSidebar
          chats={chatsQuery.data?.chats ?? []}
          activeChatId={chatId}
          search={sidebarSearch}
          onSearchChange={setSidebarSearch}
          onSelectChat={(id) => router.push(`/chat/${id}`)}
          onNewChat={() => newChatMutation.mutate()}
          onDeleteChat={(id) => {
            if (
              typeof window !== "undefined" &&
              !window.confirm("Delete this chat?")
            ) {
              return;
            }
            deleteChatMutation.mutate(id);
          }}
          isLoading={chatsQuery.isLoading}
          newChatPending={newChatMutation.isPending}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          isGuest={isGuest}
          remaining={remaining}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <ChatThread
            messages={messages}
            streamingText={streamingText}
            isLoading={
              sessionReady &&
              !!effectiveChatId &&
              messagesQuery.isLoading
            }
            emptyHint={
              effectiveChatId
                ? "No messages yet. Say hello below — Enter sends, Shift+Enter adds a line."
                : "Create a new chat or pick one from the sidebar. On mobile, open the menu to see your chats."
            }
          />

          <ChatComposerBar
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onRetry={sendState === "error" ? handleRetry : undefined}
            disabled={!sessionReady}
            sending={sendState === "sending"}
            blocked={sendState === "blocked"}
            error={sendState === "error"}
            chatModels={chatModels}
            selectedModelId={selectedModelId}
            onModelChange={setSelectedModelId}
            imagePreviews={images}
            docPreviews={docs}
            onRemoveImage={removeImage}
            onRemoveDoc={removeDoc}
            onPickImages={pickImages}
            onPickDocs={pickDocs}
          />
        </div>
      </div>
    </div>
  );
}
