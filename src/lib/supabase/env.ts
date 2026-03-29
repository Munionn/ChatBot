import {
  formatSupabaseEnvIssues,
  parseSupabaseEnv,
  resolveSupabaseUrl
} from "@/lib/env/supabase";

export function getSupabaseUrl(): string | null {
  const url = resolveSupabaseUrl();
  return /^https?:\/\//i.test(url) ? url : null;
}

export function getSupabaseAnonKey(): string | null {
  const r = parseSupabaseEnv();
  return r.ok ? r.data.anonKey : null;
}

export function getSupabaseAnonKeyIssue(): string | null {
  const r = parseSupabaseEnv();
  if (r.ok) return null;
  return formatSupabaseEnvIssues(r.error);
}

export function isSupabaseConfigured(): boolean {
  return parseSupabaseEnv().ok;
}
