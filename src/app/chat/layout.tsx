import type { ReactNode } from "react";

import ChatShell from "@/components/chat/ChatShell";
import { ChatSessionProvider } from "@/components/chat/chat-session-context";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <ChatSessionProvider>
      <ChatShell />
      {children}
    </ChatSessionProvider>
  );
}
