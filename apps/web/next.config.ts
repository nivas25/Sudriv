import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Monorepo: pin file tracing to repo root for Vercel
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Only packages that actually exist in this monorepo (avoid build noise)
  transpilePackages: [],

  images: {
    remotePatterns: [],
  },

  // Fail the production build on type/ESLint errors
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
