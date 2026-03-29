import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured
} from "./lib/supabase/env";

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"]
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const url = getSupabaseUrl()!;
  const anonKey = getSupabaseAnonKey()!;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (!value) {
            response.cookies.delete(name);
          } else {
            response.cookies.set(name, value, options as CookieOptions);
          }
        });
      }
    }
  });

  await supabase.auth.getUser();

  return response;
}
