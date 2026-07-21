import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for development safety
  reactStrictMode: true,

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
