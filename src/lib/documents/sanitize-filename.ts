export function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").trim().slice(0, 180);
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").replace(/_+/g, "_");
  return cleaned.length > 0 ? cleaned : "document";
}
