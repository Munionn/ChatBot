import { z } from "zod";

import {
  supabaseEnvSchema,
  type SupabaseEnvParsed
} from "@/lib/types/env";

export type { SupabaseEnvParsed };

export function pickSupabaseUrl(env: NodeJS.ProcessEnv): string {
  const np = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (/^https?:\/\//i.test(np)) return np;
  const fallback = (env.SUPABASE_URL ?? "").trim();
  if (/^https?:\/\//i.test(fallback)) return fallback;
  return np || fallback;
}
export function resolveSupabaseUrl(): string {
  const fromPublic = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (/^https?:\/\//i.test(fromPublic)) return fromPublic;
  if (typeof window === "undefined") {
    const fromServer = (process.env.SUPABASE_URL ?? "").trim();
    if (/^https?:\/\//i.test(fromServer)) return fromServer;
  }
  return "";
}

export function pickSupabaseAnonKeyRaw(env: NodeJS.ProcessEnv): string {
  return (
    (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() ||
    (env.SUPABASE_ANON_KEY ?? "").trim() ||
    ""
  );
}

export function resolveSupabaseAnonKey(): string {
  const fromPublic = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (fromPublic) return fromPublic;
  if (typeof window === "undefined") {
    return (process.env.SUPABASE_ANON_KEY ?? "").trim();
  }
  return "";
}

export function parseSupabaseEnv(
  env: NodeJS.ProcessEnv = process.env
):
  | { ok: true; data: SupabaseEnvParsed }
  | { ok: false; error: z.ZodError } {
  const url =
    typeof window === "undefined" ? pickSupabaseUrl(env) : resolveSupabaseUrl();
  const anonKey =
    typeof window === "undefined"
      ? pickSupabaseAnonKeyRaw(env)
      : resolveSupabaseAnonKey();
  const parsed = supabaseEnvSchema.safeParse({
    url,
    anonKey
  });
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, error: parsed.error };
}

export function formatSupabaseEnvIssues(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(" ");
}
