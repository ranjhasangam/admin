import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AdminMe, Permission } from "@/lib/types";

/**
 * Server-side authorization for pages.
 *  - No auth session            → redirect to /login
 *  - Auth user without an active admin profile → sign out + redirect
 *  - Otherwise returns the Supabase client (user JWT) + the admin identity.
 *
 * The real enforcement lives in the database: every RPC re-checks
 * admin_can() with the caller's JWT. This guard is for routing/UX.
 */
export async function requireAdmin(): Promise<{ supabase: SupabaseClient; admin: AdminMe }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase.rpc("admin_session_me");
  const admin = data as AdminMe | null;

  if (!admin) {
    // Authenticated, but not an (active) administrator → end the session.
    await supabase.auth.signOut();
    redirect("/login?error=not_admin");
  }

  return { supabase, admin };
}

export interface GuardedContext {
  supabase: SupabaseClient;
  admin: AdminMe;
}

/**
 * Server-side authorization for server actions / route handlers.
 * Returns an error string instead of redirecting (actions must not redirect
 * on failure — the UI shows a toast).
 */
export async function getGuardedAdmin(perm?: Permission): Promise<
  | { ok: true; supabase: SupabaseClient; admin: AdminMe }
  | { ok: false; error: string; status?: number }
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again.", status: 401 };

  const { data } = await supabase.rpc("admin_session_me");
  const admin = data as AdminMe | null;
  if (!admin) return { ok: false, error: "Admin access not found or deactivated.", status: 403 };

  if (perm && !admin.permissions.includes(perm)) {
    return { ok: false, error: "You do not have permission to perform this action.", status: 403 };
  }

  return { ok: true, supabase, admin };
}
