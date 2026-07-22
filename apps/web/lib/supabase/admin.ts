import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client (service role key) — bypasses RLS.
 * 
 * ONLY use this in trusted server-side API routes where you need
 * to write to tables that the authenticated user's RLS policies
 * might not cover (e.g., upserting into public.users).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
