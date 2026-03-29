export const CHAT_IMAGES_BUCKET = "chat-images";

export const CHAT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const CHAT_IMAGE_MAX_PER_MESSAGE = 6;

export const CHAT_IMAGE_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/gif",
  "image/webp"
]);

export function isChatImageFileAllowed(file: File): boolean {
  if (file.size > CHAT_IMAGE_MAX_BYTES) return false;
  const t = file.type?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (t && CHAT_IMAGE_ALLOWED_MIME.has(t)) return true;
  const n = file.name.toLowerCase();
  return /\.(jpe?g|png|gif|webp)$/i.test(n);
}
