import { buildHfChatMessages } from "./build-messages";
import {
  getHuggingFaceClient,
  hfInferenceProvider,
  hfMaxTokens,
  hfTemperature
} from "./huggingface";
import { sanitizeAssistantText } from "./sanitize-assistant-text";
import { textFromChatStreamChunk } from "./stream-delta";
import type { StreamChatInput } from "@/lib/types/llm";

function hfChatArgs(input: StreamChatInput) {
  const provider = hfInferenceProvider();
  return {
    model: input.model,
    messages: buildHfChatMessages(input) as never,
    max_tokens: hfMaxTokens(),
    temperature: hfTemperature(),
    ...(provider !== undefined ? { provider } : {})
  };
}

export async function* streamChat(
  input: StreamChatInput
): AsyncGenerator<string, void, undefined> {
  const client = getHuggingFaceClient();
  const hfStream = client.chatCompletionStream(
    hfChatArgs(input),
    input.signal ? { signal: input.signal } : undefined
  );

  for await (const chunk of hfStream) {
    const delta = textFromChatStreamChunk(chunk);
    if (delta.length > 0) yield delta;
  }
}

export async function chatCompletionTextFallback(
  input: StreamChatInput
): Promise<string> {
  const client = getHuggingFaceClient();
  const res = await client.chatCompletion(hfChatArgs(input));
  const message = res.choices?.[0]?.message as
    | { content?: unknown; reasoning_content?: unknown }
    | undefined;
  if (!message) return "";

  const c = message.content;
  if (typeof c === "string" && c.trim()) {
    return sanitizeAssistantText(c);
  }
  if (Array.isArray(c)) {
    const joined = c
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
    if (joined.trim()) return sanitizeAssistantText(joined);
  }

  const r = message.reasoning_content;
  if (typeof r === "string" && r.trim()) {
    return sanitizeAssistantText(r);
  }

  return "";
}
