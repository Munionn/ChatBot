import { buildHfChatMessages } from "./build-messages";
import {
  getHuggingFaceClient,
  hfInferenceProvider,
  hfMaxTokens,
  hfTemperature
} from "./huggingface";
import type { StreamChatInput } from "./types";

export async function* streamChat(
  input: StreamChatInput
): AsyncGenerator<string, void, undefined> {
  const client = getHuggingFaceClient();
  const messages = buildHfChatMessages(input);
  const provider = hfInferenceProvider();

  const hfStream = client.chatCompletionStream(
    {
      model: input.model,
      messages: messages as never,
      max_tokens: hfMaxTokens(),
      temperature: hfTemperature(),
      ...(provider !== undefined ? { provider } : {})
    },
    input.signal ? { signal: input.signal } : undefined
  );

  for await (const chunk of hfStream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
