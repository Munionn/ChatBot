import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import {
  getSupabaseAnonKey,
  getSupabaseAnonKeyIssue,
  getSupabaseUrl
} from "./env";


export async function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url) {
    throw new Error(
      "Supabase URL missing. Set NEXT_PUBLIC_SUPABASE_URL (https://…supabase.co) — see README."
    );
  }
  if (!anonKey) {
    throw new Error(
      getSupabaseAnonKeyIssue() ??
        "Supabase anon key invalid or missing — use the JWT from Dashboard → Settings → API. See README."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (!value) {
              cookieStore.delete(name);
            } else {
              cookieStore.set(name, value, options as CookieOptions);
            }
          });
        } catch {
        }
      }
    }
  });
}
