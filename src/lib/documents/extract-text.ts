import "server-only";

import pdfParse from "pdf-parse";

import { DOCUMENT_ALLOWED_MIME } from "@/lib/constants/documents";

function decodeUtf8(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  } catch {
    return buffer.toString("utf-8");
  }
}

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (mime === "text/plain" || mime === "text/markdown") {
    return decodeUtf8(buffer).trim();
  }

  if (mime === "application/pdf") {
    const data = await pdfParse(buffer);
    return (data.text ?? "").trim();
  }

  if (DOCUMENT_ALLOWED_MIME.has(mime)) {
    return decodeUtf8(buffer).trim();
  }

  throw new Error(`Unsupported document type: ${mimeType || "unknown"}`);
}
