export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_MAX_PER_MESSAGE = 12;

export const DOCUMENT_BUCKET = "chat-documents";

export const DOCUMENT_ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf"
]);

export const DOCUMENT_CONTEXT_MAX_CHARS = 9000;

export const DOCUMENT_CHUNK_SIZE = 1200;
export const DOCUMENT_CHUNK_OVERLAP = 160;

export const DOCUMENT_MAX_CHUNKS = 400;
