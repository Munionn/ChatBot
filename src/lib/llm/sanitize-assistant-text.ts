export function sanitizeAssistantText(text: string): string {
  if (!text) return text;
  const original = text.trim();

  let s = original
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();

  s = stripAfterThinkingProcessHeader(s);
  s = stripLeadingMetaParagraphs(s);

  if (s.length === 0 && original.length > 0) return original;
  return s;
}

function stripAfterThinkingProcessHeader(s: string): string {
  const tp = /\bThinking\s+Process\s*:\s*/i.exec(s);
  if (!tp) return s;
  const after = s.slice(tp.index + tp[0].length);
  const blocks = after.split(/\n\n+/);
  let i = 0;
  while (i < blocks.length) {
    const first = blocks[i].split("\n")[0].trim();
    if (
      /^\d+\.\s+\*\*/.test(first) ||
      /^\*\*(?:Analyze|Determine|Drafting|Refining)\b/i.test(first)
    ) {
      i++;
      continue;
    }
    break;
  }
  const kept = blocks.slice(i).join("\n\n").trim();
  return kept.length > 0 ? kept : s;
}

function stripLeadingMetaParagraphs(s: string): string {
  const head = s.slice(0, Math.min(6000, s.length));
  const looksMetaHeavy =
    /\bconversation history provided in the\b/i.test(head) ||
    /\bAnalyze\s+the\s+Request\s*:/i.test(head) ||
    /\(This is where I am now\)/i.test(head) ||
    /\bUser:\s*[^\n]+\b[\s\S]{0,200}\bModel:\s*/i.test(head) ||
    (/^\s*[*•]\s*(?:Wait|Actually|Okay|Let's)\b/im.test(s) &&
      /\bModel:\s*\(Empty/i.test(head));

  if (!looksMetaHeavy) return s;

  const paras = s.split(/\n\n+/);
  let i = 0;
  while (i < paras.length && isMetaParagraph(paras[i])) {
    i++;
  }
  const rest = paras.slice(i).join("\n\n").trim();
  return rest.length > 0 ? rest : s;
}

function isMetaParagraph(p: string): boolean {
  const t = p.trim();
  if (t.length < 12) return false;

  const lower = t.toLowerCase();
  if (lower.includes("conversation history provided in the")) return true;
  if (/\banalyze\s+the\s+request\s*:/i.test(t)) return true;
  if (/\bthinking\s+process\s*:/i.test(t)) return true;
  if (/\(this is where i am now\)/i.test(lower)) return true;
  if (
    /\bthe previous model response\b/i.test(lower) &&
    /\b(incorrect|hallucinated|treated it as)\b/i.test(lower)
  ) {
    return true;
  }
  if (
    /\bmy goal is to provide\b/i.test(lower) &&
    /\b(accurate response|helpful)\b/i.test(lower)
  ) {
    return true;
  }

  if (t.length < 2000 && /\buser:\s*/i.test(t) && /\bmodel:\s*/i.test(t)) {
    return true;
  }

  if (
    /^\s*[*•-]\s*(?:Wait|Actually|Okay|Let's)\b/i.test(t) &&
    (/\b(user|model):\s*/i.test(t) || /provided in the \*prompt\*/i.test(t))
  ) {
    return true;
  }

  return false;
}
