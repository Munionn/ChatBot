"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { loginErrorHelp } from "@/lib/auth/login-errors";
import { supabaseBrowser } from "@/lib/supabase/browser";

function LoginErrorMessage({ message }: { message: string }) {
  const { primary, hint } = loginErrorHelp(message);
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-red-600">{primary}</p>
      {hint ? (
        <p className="leading-relaxed text-slate-600 dark:text-slate-400">
          {hint}{" "}
          <a
            href="https://supabase.com/docs/guides/auth/rate-limits"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-600 underline dark:text-sky-400"
          >
            Supabase rate limits →
          </a>
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const emailIsValid = useMemo(() => email.trim().includes("@"), [email]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setError(null);
    setStatus("sending");

    try {
      const emailTrimmed = email.trim();
      const origin = window.location.origin;

      const { error: otpError } = await supabaseBrowser.auth.signInWithOtp({
        email: emailTrimmed,
        options: {
          emailRedirectTo: `${origin}/auth/callback`
        }
      });

      if (otpError) {
        setStatus("error");
        setError(otpError.message);
        return;
      }

      setStatus("sent");
    } finally {
      submitLockRef.current = false;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-slate-200 p-6 dark:border-slate-700">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Sign in
        </h1>
        <p className="mb-6 text-slate-600 dark:text-slate-400">
          Use email magic link to access the full chat.
        </p>

        {status === "sent" ? (
          <div className="space-y-4">
            <p className="text-slate-700 dark:text-slate-300">
              Check your email for the sign-in link.
            </p>
            <button
              className="h-10 w-full rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => router.push("/chat")}
              type="button"
            >
              Continue as guest
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </span>
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 caret-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-slate-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:caret-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-slate-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                required
              />
            </label>

            <button
              className="h-10 w-full rounded-md bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-60"
              disabled={status === "sending" || !emailIsValid}
              type="submit"
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>

            {status === "error" && error ? (
              <LoginErrorMessage message={error} />
            ) : null}
          </form>
        )}

        {status !== "sent" ? (
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
            <button
              className="h-10 w-full rounded-md border border-slate-300 bg-transparent text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/60"
              onClick={() => router.push("/chat")}
              type="button"
            >
              Continue as guest
            </button>
            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Use the app without an account (limited guest messages).
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

