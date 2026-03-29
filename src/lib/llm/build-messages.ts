import type { StreamChatInput } from "./types";

function contextSystemBlock(input: StreamChatInput): string | null {
  const docs = input.contextDocs?.filter((d) => d.content.trim()) ?? [];
  if (docs.length === 0) return null;
  const parts = docs.map((d, i) => {
    const head = d.title?.trim()
      ? `### ${d.title.trim()}\n`
      : `### Context ${i + 1}\n`;
    return `${head}${d.content.trim()}`;
  });
  return `Use the following context when answering. If it conflicts with the user, prefer the user.\n\n${parts.join("\n\n")}`;
}

function imageNotice(input: StreamChatInput): string | null {
  const n = input.images?.length ?? 0;
  if (n === 0) return null;
  return `[System note: ${n} image attachment(s) were provided; this deployment uses a text-only model path. Describe limitations if the user expects vision.]`;
}

type HfContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type HfChatMessage =
  | { role: "system" | "assistant" | "user"; content: string }
  | { role: "user"; content: HfContentPart[] };


export function buildHfChatMessages(input: StreamChatInput): HfChatMessage[] {
  const preamble: string[] = [];
  const ctx = contextSystemBlock(input);
  if (ctx) preamble.push(ctx);

  const hasVisionPayload = (input.lastUserImageDataUrls?.length ?? 0) > 0;
  if (!hasVisionPayload) {
    const img = imageNotice(input);
    if (img) preamble.push(img);
  }

  const merged = preamble.length > 0 ? preamble.join("\n\n") : null;

  let base: HfChatMessage[] = input.messages.map((m) => ({
    role: m.role,
    content: m.content
  }));

  if (merged) {
    const firstSystemIdx = base.findIndex((m) => m.role === "system");
    if (firstSystemIdx >= 0) {
      const cur = base[firstSystemIdx].content;
      if (typeof cur === "string") {
        base = [...base];
        base[firstSystemIdx] = {
          role: "system",
          content: `${merged}\n\n${cur}`
        };
      }
    } else {
      base = [{ role: "system", content: merged }, ...base];
    }
  }

  const urls = input.lastUserImageDataUrls ?? [];
  if (urls.length === 0) return base;

  const lastIdx = base.length - 1;
  if (lastIdx < 0 || base[lastIdx].role !== "user") return base;

  const text = base[lastIdx].content;
  if (typeof text !== "string") return base;

  const content: HfContentPart[] = [
    { type: "text", text },
    ...urls.map((url) => ({
      type: "image_url" as const,
      image_url: { url }
    }))
  ];

  const copy = [...base];
  copy[lastIdx] = { role: "user", content };
  return copy;
}
