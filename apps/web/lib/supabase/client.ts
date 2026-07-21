import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client
 * Used in Client Components for real-time subscriptions and data fetching
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
