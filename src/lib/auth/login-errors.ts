export function loginErrorHelp(raw: string): {
  primary: string;
  hint: string | null;
} {
  const m = raw.toLowerCase();
  if (
    m.includes("rate limit") &&
    (m.includes("email") || m.includes("otp") || m.includes("sign"))
  ) {
    return {
      primary: "Too many magic-link emails were sent recently.",
      hint:
        "Supabase limits how often the same address can get a link (and caps project-wide sends). Wait a few minutes, avoid double-clicking “Send magic link”, then try again. To allow more traffic: Supabase Dashboard → Authentication → Rate limits. With Supabase’s built-in email, hourly limits are tight; adding custom SMTP usually lets you raise them."
    };
  }
  if (m.includes("429") || m.includes("too many requests")) {
    return {
      primary: "Too many requests. Please wait a bit and try again.",
      hint:
        "Your project’s auth rate limits were hit. Adjust them under Authentication → Rate limits if you own the Supabase project."
    };
  }
  return { primary: raw, hint: null };
}
