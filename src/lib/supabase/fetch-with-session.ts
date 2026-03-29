"use client";

import { supabaseBrowser } from "./browser";

async function mergeSessionAuth(
  init?: RequestInit
): Promise<RequestInit> {
  const {
    data: { session }
  } = await supabaseBrowser.auth.getSession();
  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return {
    ...init,
    credentials: init?.credentials ?? "include",
    headers
  };
}


export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, await mergeSessionAuth(init));
  if (res.status !== 401) {
    return res;
  }
  await supabaseBrowser.auth.refreshSession();
  return fetch(input, await mergeSessionAuth(init));
}
