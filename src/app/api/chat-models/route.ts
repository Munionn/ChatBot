import { NextResponse } from "next/server";

import { getAllowedChatModels } from "@/lib/llm/allowed-models";
import { getRouteUser } from "@/lib/supabase/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const models = getAllowedChatModels();
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load models" },
      { status: 500 }
    );
  }
}
