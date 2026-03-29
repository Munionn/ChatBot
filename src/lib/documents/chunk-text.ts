import {
  DOCUMENT_CHUNK_OVERLAP,
  DOCUMENT_CHUNK_SIZE,
  DOCUMENT_MAX_CHUNKS
} from "@/lib/constants/documents";

export function chunkText(
  text: string,
  chunkSize = DOCUMENT_CHUNK_SIZE,
  overlap = DOCUMENT_CHUNK_OVERLAP
): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return [];

  const chunks: string[] = [];
  let i = 0;

  while (i < t.length && chunks.length < DOCUMENT_MAX_CHUNKS) {
    const end = Math.min(i + chunkSize, t.length);
    let slice = t.slice(i, end);

    if (end < t.length) {
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n")
      );
      const lastSpace = slice.lastIndexOf(" ");
      const prefer =
        lastBreak >= Math.floor(chunkSize * 0.45)
          ? lastBreak + (slice[lastBreak] === "\n" ? 1 : 0)
          : lastSpace >= Math.floor(chunkSize * 0.45)
            ? lastSpace + 1
            : -1;
      if (prefer > 80) {
        slice = slice.slice(0, prefer).trimEnd();
      }
    }

    const trimmed = slice.trim();
    if (trimmed.length > 0) chunks.push(trimmed);

    const step = Math.max(80, trimmed.length - overlap);
    i += step;
  }

  return chunks;
}
