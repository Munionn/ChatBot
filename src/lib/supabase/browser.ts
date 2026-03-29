"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonKey,
  getSupabaseAnonKeyIssue,
  getSupabaseUrl
} from "./env";


function createBrowserSupabase(): SupabaseClient {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url) {
    throw new Error(
      "[chatbot] Missing NEXT_PUBLIC_SUPABASE_URL (https://….supabase.co). See README."
    );
  }
  if (!anonKey) {
    throw new Error(
      `[chatbot] ${getSupabaseAnonKeyIssue() ?? "Invalid Supabase anon key."}\n` +
        "Without the real anon JWT, /auth/v1/token and Realtime return 401. See README → Environment variables."
    );
  }
  return createBrowserClient(url, anonKey);
}

let cached: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (!cached) {
    cached = createBrowserSupabase();
  }
  return cached;
}

export const supabaseBrowser = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver) as unknown;
    return typeof value === "function"
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value;
  }
});
