import { z } from "zod";

export const supabaseEnvSchema = z.object({
  url: z
    .string()
    .min(1, "Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL (https://….supabase.co)")
    .regex(/^https?:\/\/.+/i, "URL must start with http:// or https://"),
  anonKey: z
    .string()
    .min(
      80,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) is too short — paste the full anon public JWT from Supabase Dashboard → Settings → API. Remember: .env.local overrides .env."
    )
    .startsWith("eyJ", "Anon key must be the public JWT (starts with eyJ), not service_role or a label like supabaseKey")
    .refine((s) => s.split(".").length === 3, "Anon key must be a JWT (three dot-separated parts)")
});

export type SupabaseEnvParsed = z.infer<typeof supabaseEnvSchema>;
