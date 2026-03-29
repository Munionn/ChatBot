"use client";

import Link from "next/link";
import { Menu, MessageSquarePlus, PanelLeftClose, Search, Trash2 } from "lucide-react";

import type { ChatSummary } from "@/lib/types/chat";
import { Button } from "@/components/ui/button";
import { useChatSession } from "@/components/chat/chat-session-context";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type ChatSidebarProps = {
  chats: ChatSummary[];
  activeChatId: string | null;
  search: string;
  onSearchChange: (q: string) => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat?: (id: string) => void;
  isLoading: boolean;
  newChatPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGuest: boolean;
  remaining: number | null;
};

export function ChatSidebar({
  chats,
  activeChatId,
  search,
  onSearchChange,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  isLoading,
  newChatPending,
  open,
  onOpenChange,
  isGuest,
  remaining
}: ChatSidebarProps) {
  const { signOut } = useChatSession();

  const filtered = search.trim()
    ? chats.filter((c) =>
        (c.title ?? "New chat").toLowerCase().includes(search.toLowerCase())
      )
    : chats;

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Chats
        </span>
        <button
          type="button"
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Close sidebar"
          onClick={() => onOpenChange(false)}
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      <div className="shrink-0 space-y-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search chats…"
            className="h-9 pl-9"
            aria-label="Search chats"
          />
        </div>
        <Button
          type="button"
          className="w-full gap-2"
          onClick={() => {
            onNewChat();
            onOpenChange(false);
          }}
          disabled={newChatPending}
        >
          <MessageSquarePlus className="size-4" />
          New chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="space-y-2 px-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {search.trim() ? "No matching chats." : "No chats yet. Start one!"}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((c) => {
              const active = c.id === activeChatId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectChat(c.id);
                      onOpenChange(false);
                    }}
                    className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? "bg-slate-200 font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-50"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate">
                      {c.title?.trim() || "New chat"}
                    </span>
                  </button>
                  {onDeleteChat ? (
                    <button
                      type="button"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-slate-400 opacity-0 hover:bg-slate-200 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-600 dark:hover:text-red-400"
                      aria-label="Delete chat"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(c.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {isGuest ? (
          <p>
            Guest turns left:{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {remaining === null ? "…" : remaining}
            </span>
            .{" "}
            <Link
              href="/login"
              className="font-medium text-sky-600 underline dark:text-sky-400"
            >
              Log in
            </Link>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Signed in</span>
            <button
              type="button"
              className="font-medium text-sky-600 underline dark:text-sky-400"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex">
        {list}
      </aside>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
      />

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-[min(100%,280px)] max-w-full flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-950 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {list}
      </aside>
    </>
  );
}

export function ChatSidebarMobileToggle({
  onClick
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0 md:hidden"
      aria-label="Open chat list"
      onClick={onClick}
    >
      <Menu className="size-5" />
    </Button>
  );
}
