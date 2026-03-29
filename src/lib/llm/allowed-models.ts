import {
  DEFAULT_CHAT_MODEL_OPTIONS,
  DEFAULT_HF_CHAT_MODEL
} from "@/lib/constants/chat-models";
import type { ChatModelOption } from "@/lib/types/chat-models";

import { defaultHfChatModel } from "./huggingface";

function shortLabel(id: string): string {
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/-/g, " ");
}

function parseEnvAllowlist(): ChatModelOption[] {
  const raw = process.env.CHAT_MODEL_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => ({ id, label: shortLabel(id) }));
}

function dedupeById(options: ChatModelOption[]): ChatModelOption[] {
  const seen = new Set<string>();
  const out: ChatModelOption[] = [];
  for (const o of options) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}


export function getAllowedChatModels(): ChatModelOption[] {
  const envList = parseEnvAllowlist();
  const base =
    envList.length > 0 ? envList : [...DEFAULT_CHAT_MODEL_OPTIONS];
  const defId = defaultHfChatModel();
  const withDefault: ChatModelOption[] = [
    { id: defId, label: shortLabel(defId) },
    ...base
  ];
  return dedupeById(withDefault);
}

export function resolveAllowedChatModel(requested: string | undefined): string {
  const allowed = new Set(getAllowedChatModels().map((m) => m.id));
  const fallback = defaultHfChatModel();
  if (!requested?.trim()) {
    return allowed.has(fallback) ? fallback : [...allowed][0] ?? DEFAULT_HF_CHAT_MODEL;
  }
  const id = requested.trim();
  if (!allowed.has(id)) {
    throw new Error("Invalid or disallowed model");
  }
  return id;
}
