import type { ChatModelOption } from "@/lib/types/chat-models";

export type { ChatModelOption };

export const DEFAULT_HF_CHAT_MODEL = "Qwen/Qwen3.5-9B";

export const DEFAULT_CHAT_MODEL_OPTIONS: ChatModelOption[] = [
  { id: "Qwen/Qwen3.5-9B", label: "Qwen 3.5 9B" },
  { id: "Qwen/Qwen3.5-4B", label: "Qwen 3.5 4B" },
  { id: "Qwen/Qwen3.5-0.8B", label: "Qwen 3.5 0.8B" },
  { id: "Qwen/Qwen3.5-27B", label: "Qwen 3.5 27B" },
  { id: "Qwen/Qwen3.5-35B-A3B", label: "Qwen 3.5 35B A3B" }
];
