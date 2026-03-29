"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { deferRouterAction } from "@/lib/next/defer-router-action";
import { supabaseBrowser } from "@/lib/supabase/browser";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function finishIfSession() {
      if (cancelled) return false;
      const {
        data: { session }
      } = await supabaseBrowser.auth.getSession();
      if (!session?.user) return false;
      await supabaseBrowser.auth.getUser();
      if (cancelled) return false;
      deferRouterAction(() => {
        router.replace("/");
        router.refresh();
      });
      return true;
    }

    async function run() {
      setStatus("loading");

      const oauthErr = searchParams.get("error");
      if (oauthErr) {
        if (!cancelled) setStatus("error");
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabaseBrowser.auth.exchangeCodeForSession(
          code
        );
        if (cancelled) return;
        if (error) {
          const recovered = await finishIfSession();
          if (!cancelled && !recovered) {
            setStatus("error");
          }
          return;
        }
        if (await finishIfSession()) return;
        if (!cancelled) setStatus("error");
        return;
      }

      const hash = window.location.hash?.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabaseBrowser.auth.setSession({
          access_token,
          refresh_token
        });
        if (cancelled) return;
        if (error) {
          const recovered = await finishIfSession();
          if (!cancelled && !recovered) {
            setStatus("error");
          }
          return;
        }
        if (await finishIfSession()) return;
        if (!cancelled) setStatus("error");
        return;
      }

      for (let i = 0; i < 8; i++) {
        if (cancelled) return;
        if (await finishIfSession()) return;
        await sleep(120);
      }

      if (!cancelled) setStatus("error");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-slate-200 p-6">
        {status === "loading" ? (
          <p className="text-slate-700">Signing you in...</p>
        ) : (
          <div className="space-y-3">
            <p className="text-red-600">Sign-in failed.</p>
            <button
              className="text-sm font-medium text-slate-900 underline"
              onClick={() => router.push("/login")}
              type="button"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
          <div className="rounded-xl border border-slate-200 p-6">
            <p className="text-slate-700">Signing you in...</p>
          </div>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
