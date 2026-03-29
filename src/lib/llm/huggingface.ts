import { InferenceClient, type InferenceProviderOrPolicy } from "@huggingface/inference";

import { DEFAULT_HF_CHAT_MODEL } from "@/lib/constants/chat-models";

function huggingFaceAccessToken(): string | undefined {
  return process.env.HUGGINGFACE_API_TOKEN ?? process.env.HF_TOKEN ?? undefined;
}

export function getHuggingFaceClient(): InferenceClient {
  const token = huggingFaceAccessToken();
  if (!token) {
    throw new Error("Neither HUGGINGFACE_API_TOKEN nor HF_TOKEN is set");
  }
  return new InferenceClient(token);
}

export function defaultHfChatModel(): string {
  const m = process.env.HF_MODEL?.trim();
  return m || DEFAULT_HF_CHAT_MODEL;
}

export function hfInferenceProvider(): InferenceProviderOrPolicy | undefined {
  const p = process.env.HF_INFERENCE_PROVIDER?.trim();
  if (!p) return undefined;
  return p as InferenceProviderOrPolicy;
}

export function hfMaxTokens(): number {
  const raw = process.env.HF_MAX_TOKENS?.trim();
  if (!raw) return 1024;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1024;
}

export function hfTemperature(): number {
  const raw = process.env.HF_TEMPERATURE?.trim();
  if (!raw) return 0.7;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0.7;
}
