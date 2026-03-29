import type { User } from "@supabase/supabase-js";

export function isGuestUser(user: User): boolean {
  if (user.is_anonymous === true) return true;
  const meta = user.user_metadata as { anon_session_id?: string } | undefined;
  return Boolean(meta?.anon_session_id);
}

export function getAnonSessionIdFromUser(user: User): string | null {
  const meta = user.user_metadata as { anon_session_id?: string } | undefined;
  return meta?.anon_session_id ?? null;
}
