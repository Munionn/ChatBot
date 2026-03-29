import type { ReactNode } from "react";

import { ChatSessionProvider } from "@/components/chat/chat-session-context";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <ChatSessionProvider>{children}</ChatSessionProvider>;
}
