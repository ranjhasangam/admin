/**
 * Central environment configuration.
 *
 * The Admin Panel talks to the SAME Supabase project as the main website.
 * Only two values are needed in the browser (URL + anon key — both are
 * public by design). The service-role key is SERVER-ONLY and is used
 * exclusively by /api route handlers for admin-user management.
 */

export const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  ""
).trim();

export const supabaseAnonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  ""
).trim();

/** SERVER ONLY. Never import this value into a client component. */
export const serviceRoleKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  ""
).trim();

export const isSupabaseConfigured = supabaseUrl !== "" && supabaseAnonKey !== "";
export const hasServiceRole = serviceRoleKey !== "";

/** Optional headless bootstrap of the first Super Admin (see /api/bootstrap). */
export const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").trim();
export const bootstrapPassword = (process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "").trim();

/** Public site URL of the main website (used for links/labels only). */
export const mainSiteUrl = (process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "https://sddigitalhub.in").trim();

/** Masked URL for display in the Settings page (never shows keys). */
export function maskedProjectRef(): string {
  try {
    const u = new URL(supabaseUrl);
    const ref = u.hostname.split(".")[0] ?? "";
    return ref ? `${ref.slice(0, 6)}…${ref.slice(-4)}` : "not configured";
  } catch {
    return "not configured";
  }
}
