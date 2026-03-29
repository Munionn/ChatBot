export function parseGuestConsumeResult(data: unknown): {
  allowed: boolean;
  remaining: number;
} {
  if (data == null) {
    return { allowed: false, remaining: 0 };
  }
  const rows = Array.isArray(data) ? data : [data];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row || typeof row !== "object") {
    return { allowed: false, remaining: 0 };
  }
  const a = row.allowed;
  const allowed =
    a === true ||
    a === "t" ||
    String(a).toLowerCase() === "true";
  const r = row.remaining;
  let remaining = 0;
  if (typeof r === "number" && !Number.isNaN(r)) {
    remaining = r;
  } else if (typeof r === "string") {
    const n = parseInt(r, 10);
    if (!Number.isNaN(n)) remaining = n;
  }
  return { allowed, remaining };
}

export function parseGuestRemainingScalar(data: unknown): number | null {
  if (typeof data === "number" && !Number.isNaN(data)) {
    return data;
  }
  if (typeof data === "string") {
    const n = parseInt(data, 10);
    return Number.isNaN(n) ? null : n;
  }
  if (Array.isArray(data) && data.length > 0) {
    return parseGuestRemainingScalar(data[0]);
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const v = o.get_guest_remaining_questions ?? o.remaining;
    if (v !== undefined) return parseGuestRemainingScalar(v);
  }
  return null;
}
