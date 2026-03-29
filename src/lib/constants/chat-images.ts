export const CHAT_IMAGES_BUCKET = "chat-images";

export const CHAT_IMAGE_SIGNED_URL_TTL_SEC = 3600;

export const CHAT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const CHAT_IMAGE_MAX_PER_MESSAGE = 12;

export const CHAT_IMAGE_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/gif",
  "image/webp"
]);

function imageExtensionOk(filename: string): boolean {
  return /\.(jpe?g|png|gif|webp)$/i.test(filename.toLowerCase());
}

export function isChatImageFileAllowed(file: File): boolean {
  if (file.size > CHAT_IMAGE_MAX_BYTES) return false;
  const t = file.type?.split(";")[0]?.trim().toLowerCase() ?? "";
  const n = file.name.toLowerCase();
  if (t && CHAT_IMAGE_ALLOWED_MIME.has(t)) return true;
  if (t === "application/octet-stream" && imageExtensionOk(n)) return true;
  if (!t && imageExtensionOk(n)) return true;
  return imageExtensionOk(n);
}
