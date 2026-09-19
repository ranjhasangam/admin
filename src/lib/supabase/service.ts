import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { hasServiceRole, serviceRoleKey, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * SERVER-ONLY service-role client.
 *
 * ⚠️  NEVER import this module from a client component and NEVER prefix the
 * key with NEXT_PUBLIC_. It is used exclusively by /api route handlers for:
 *   - creating / deactivating / deleting admin auth users (GoTrue admin API)
 *   - resetting admin passwords
 *   - login rate-limit bookkeeping (admin_login_attempts)
 *   - the optional headless first-Super-Admin bootstrap
 */
export function createServiceClient() {
  if (!hasServiceRole) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set on the server. It is required for admin-user management."
    );
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Read-only client with the anon key for server-side public data (no cookies). */
export function createAnonServerClient() {
  return createSupabaseClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
