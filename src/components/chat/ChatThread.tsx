"use client";

import { useEffect, useRef } from "react";

import type { ChatMessageRow } from "@/lib/types/chat";
import { Skeleton } from "@/components/ui/skeleton";

type ChatThreadProps = {
  messages: ChatMessageRow[];
  streamingText: string | null;
  isLoading: boolean;
  emptyHint: string;
};

export function ChatThread({
  messages,
  streamingText,
  isLoading,
  emptyHint
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  const streamingActive = streamingText !== null;

  if (
    isLoading &&
    !streamingActive &&
    messages.length === 0
  ) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Skeleton className="ml-auto h-16 w-[min(100%,320px)] rounded-2xl" />
        <Skeleton className="h-24 w-[min(100%,85%)] rounded-2xl" />
        <Skeleton className="ml-auto h-12 w-[min(100%,240px)] rounded-2xl" />
      </div>
    );
  }
  const showEmpty =
    messages.length === 0 && !streamingActive;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {showEmpty ? (
        <div className="m-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
          {emptyHint}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[min(100%,85%)] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm ${
                m.role === "user"
                  ? "ml-auto bg-slate-900 text-white dark:bg-slate-700"
                  : "mr-auto border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              {m.role === "user" && m.imageUrls && m.imageUrls.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.imageUrls.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URLs from API
                    <img
                      key={`${m.id}-img-${i}`}
                      src={src}
                      alt=""
                      className="max-h-48 max-w-full rounded-lg object-contain"
                    />
                  ))}
                </div>
              ) : null}
              {m.content}
              {m.role === "assistant" && m.model ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {m.model}
                </p>
              ) : null}
            </div>
          ))}

          {streamingActive && streamingText !== null ? (
            <div className="mr-auto max-w-[min(100%,85%)] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm whitespace-pre-wrap text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              {streamingText.length > 0 ? (
                <>
                  {streamingText}
                  <span
                    className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-sky-500 align-middle dark:bg-sky-400"
                    aria-hidden
                  />
                </>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  Thinking…
                </span>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {streamingText.length > 0 ? "Typing…" : "Waiting for model"}
              </p>
            </div>
          ) : null}
          <div ref={bottomRef} className="h-1 shrink-0" />
        </div>
      )}
    </div>
  );
}
