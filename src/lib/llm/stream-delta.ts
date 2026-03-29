export function textFromChatStreamChunk(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") return "";
  const c = chunk as {
    choices?: Array<{
      delta?: Record<string, unknown>;
      message?: { content?: unknown };
    }>;
  };
  const choice = c.choices?.[0];
  if (!choice) return "";

  const d = choice.delta;
  if (d && typeof d === "object") {
    const content = d.content;
    if (typeof content === "string" && content.length > 0) return content;
    if (Array.isArray(content)) {
      let out = "";
      for (const part of content) {
        if (typeof part === "string") out += part;
        else if (part && typeof part === "object" && "text" in part) {
          out += String((part as { text?: unknown }).text ?? "");
        }
      }
      if (out.length > 0) return out;
    }
    for (const key of ["reasoning_content", "reasoning", "text"] as const) {
      const v = d[key];
      if (typeof v === "string" && v.length > 0) return v;
    }
  }

  const msg = choice.message;
  if (msg && typeof msg === "object") {
    const m = msg as { content?: unknown; reasoning_content?: unknown };
    const mc = m.content;
    if (typeof mc === "string" && mc.length > 0) return mc;
    const mr = m.reasoning_content;
    if (typeof mr === "string" && mr.length > 0) return mr;
  }

  return "";
}
