import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Enable React strict mode for development safety
  reactStrictMode: true,

  // Monorepo root (avoids wrong lockfile root inference with apps/web/package-lock.json)
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Transpile workspace packages
  transpilePackages: ["@sudriv/shared", "@sudriv/database"],

  // Environment variable validation at build time
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  },

  // Image optimization config
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
