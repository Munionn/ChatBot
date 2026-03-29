import type { SupabaseClient, User } from "@supabase/supabase-js";


export async function getRouteUser(
  supabase: SupabaseClient,
  request: Request
): Promise<{ user: User | null; errorMessage: string | null }> {
  const {
    data: { user: cookieUser },
    error: cookieErr
  } = await supabase.auth.getUser();
  if (cookieUser) {
    return { user: cookieUser, errorMessage: null };
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const jwt = auth.slice(7).trim();
    if (jwt.length > 0) {
      const { data, error } = await supabase.auth.getUser(jwt);
      if (data.user) return { user: data.user, errorMessage: null };
      return {
        user: null,
        errorMessage: error?.message ?? cookieErr?.message ?? null
      };
    }
  }

  return { user: null, errorMessage: cookieErr?.message ?? null };
}
