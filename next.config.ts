import type { NextConfig } from "next";

import {
  pickSupabaseAnonKeyRaw,
  pickSupabaseUrl
} from "./src/lib/env/supabase";


const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: pickSupabaseUrl(process.env),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pickSupabaseAnonKeyRaw(process.env)
  }
};

export default nextConfig;
