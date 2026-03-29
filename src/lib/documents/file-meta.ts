import { DOCUMENT_ALLOWED_MIME, DOCUMENT_MAX_BYTES } from "@/lib/constants/documents";

function inferDocumentMimeFromFile(file: File): string | null {
  const raw = file.type?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (raw && DOCUMENT_ALLOWED_MIME.has(raw)) return raw;
  const n = file.name.toLowerCase();
  if (n.endsWith(".md")) return "text/markdown";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".pdf")) return "application/pdf";
  return null;
}

export function isDocumentFileAllowed(file: File): boolean {
  return (
    inferDocumentMimeFromFile(file) != null && file.size <= DOCUMENT_MAX_BYTES
  );
}

export function inferMimeFromFilename(filename: string): string | null {
  const n = filename.toLowerCase();
  if (n.endsWith(".md")) return "text/markdown";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".pdf")) return "application/pdf";
  return null;
}
