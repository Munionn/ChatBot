import { NextResponse } from "next/server";

import { isGuestUser } from "@/lib/auth/session-context";
import { GUEST_MESSAGE_QUOTA } from "@/lib/constants/chat";
import { parseGuestRemainingScalar } from "@/lib/guest-quota";
import { getRouteUser } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGuestUser(user)) {
    return NextResponse.json({ remaining: null });
  }

  const { data, error } = await supabase.rpc("get_guest_remaining_questions", {
    max_questions: GUEST_MESSAGE_QUOTA
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ remaining: parseGuestRemainingScalar(data) });
}
