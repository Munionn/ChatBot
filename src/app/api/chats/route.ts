import { NextResponse } from "next/server";

import { createChatBodySchema } from "@/lib/api/schemas";
import { getAnonSessionIdFromUser, isGuestUser } from "@/lib/auth/session-context";
import { getRouteUser } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("chats")
    .select("id,title,created_at,updated_at,last_message_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chats: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = createChatBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const title = parsed.data.title?.trim() || "New chat";
  const guest = isGuestUser(user);
  const anonId = getAnonSessionIdFromUser(user);

  const { data, error } = await supabase
    .from("chats")
    .insert({
      title,
      user_id: guest ? null : user.id,
      anon_session_id: guest ? anonId : null,
      last_message_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
