import type { ContextDoc } from "@/lib/llm/types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "boy",
  "did",
  "she",
  "use",
  "many",
  "then",
  "them",
  "when",
  "what",
  "with",
  "have",
  "from",
  "that",
  "this",
  "your",
  "will",
  "just",
  "into",
  "than",
  "also",
  "been",
  "more",
  "some",
  "time",
  "very",
  "about",
  "after",
  "would",
  "there",
  "their",
  "which"
]);

export type ChunkRow = {
  content: string;
  documentName: string;
};

function tokenizeQuery(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(terms)].slice(0, 14);
}

function scoreChunk(content: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const low = content.toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (low.includes(t)) s += 1;
  }
  return s;
}


export function selectChunksForPrompt(
  rows: ChunkRow[],
  userMessage: string,
  maxChars: number
): ContextDoc[] {
  if (rows.length === 0) return [];

  const terms = tokenizeQuery(userMessage);
  const scored = rows.map((row, idx) => ({
    row,
    idx,
    score:
      terms.length === 0
        ? 0
        : scoreChunk(row.content, terms)
  }));

  const ordered =
    terms.length === 0 || scored.every((s) => s.score === 0)
      ? [...scored].sort((a, b) => a.idx - b.idx)
      : [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx);

  const merged = new Map<string, string[]>();
  let used = 0;

  for (const { row } of ordered) {
    if (used >= maxChars) break;
    const headroom = maxChars - used - 24;
    if (headroom < 80) break;
    const piece = row.content.slice(0, Math.min(row.content.length, headroom));
    if (piece.trim().length < 40) continue;
    const key = row.documentName;
    const list = merged.get(key) ?? [];
    list.push(piece.trim());
    merged.set(key, list);
    used += piece.length + 8;
  }

  const docs: ContextDoc[] = [];
  for (const [title, parts] of merged) {
    docs.push({
      title,
      content: parts.join("\n\n---\n\n")
    });
  }

  return docs;
}
