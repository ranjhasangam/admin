"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasServiceRole, isSupabaseConfigured } from "@/lib/env";
import type { AdminMe } from "@/lib/types";
import { logRpcError } from "@/lib/rpc-errors";

export interface LoginState {
  error?: string;
  email?: string;
}

const MAX_FAILURES = 8;
const WINDOW_MINUTES = 15;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function clientIpHash(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
    const ip = fwd.split(",")[0]?.trim();
    return ip ? sha256(ip) : null;
  } catch {
    return null;
  }
}

/**
 * Login with:
 *  - Supabase Auth (email + password) — same Supabase project as the website
 *  - app-level rate limiting / lockout (admin_login_attempts, server-only)
 *  - admin-profile + is_active check via admin_session_me()
 *  - audit log entry (auth.login)
 */
export async function loginAction(prevState: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured) {
    return { error: "The Admin Panel is not configured yet (missing Supabase environment variables)." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const ipHash = await clientIpHash();

  // ---- Rate limiting (requires the server-only service role key) ----------
  let service: ReturnType<typeof createServiceClient> | null = null;
  if (hasServiceRole) {
    try {
      service = createServiceClient();
      const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
      const { count } = await service
        .from("admin_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("success", false)
        .gte("created_at", since)
        .or(`email.eq.${email}${ipHash ? `,ip_hash.eq.${ipHash}` : ""}`);

      if ((count ?? 0) >= MAX_FAILURES) {
        return {
          error: `Too many failed attempts. Try again in ${WINDOW_MINUTES} minutes or contact a Super Admin.`,
          email,
        };
      }
    } catch (e) {
      logRpcError("login rate-limit check", e);
      // Fail open ONLY for the rate-limit bookkeeping — auth itself still applies
      // (Supabase Auth enforces its own rate limits).
    }
  }

  const recordAttempt = async (success: boolean) => {
    if (!service) return;
    try {
      await service.from("admin_login_attempts").insert({ email, ip_hash: ipHash, success });
      // Opportunistic cleanup (keep table small).
      if (!success && Math.random() < 0.05) {
        const cutoff = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
        await service.from("admin_login_attempts").delete().lt("created_at", cutoff);
      }
    } catch (e) {
      logRpcError("record login attempt", e);
    }
  };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await recordAttempt(false);
    return { error: "Invalid email or password.", email };
  }

  // ---- Admin profile gate: authenticated ≠ administrator -------------------
  let admin: AdminMe | null = null;
  try {
    const { data: me, error: meError } = await supabase.rpc("admin_session_me", { p_touch: true });
    admin = (me as AdminMe) ?? null;
    if (meError) logRpcError("admin_session_me", meError);
  } catch (e) {
    logRpcError("admin_session_me", e);
  }

  if (!admin) {
    await supabase.auth.signOut();
    await recordAttempt(false);
    return {
      error: "This account does not have Admin Panel access (no active admin profile). Ask a Super Admin to grant it.",
      email,
    };
  }

  await recordAttempt(true);
  try {
    await supabase.rpc("admin_record_audit", {
      p_action: "auth.login",
      p_section: "auth",
      p_record_id: admin.id,
      p_details: { role: admin.role },
    });
  } catch (e) {
    logRpcError("audit login", e);
  }

  const next = String(formData.get("next") || "/dashboard");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(safeNext);
}

/** Logout: best-effort audit entry, then destroy the session everywhere. */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase.rpc("admin_record_audit", {
      p_action: "auth.logout",
      p_section: "auth",
      p_record_id: null,
      p_details: {},
    });
  } catch {
    /* best effort */
  }
  await supabase.auth.signOut();
  redirect("/login");
}

/** Anti-CSRF-ish state token for sensitive flows (kept server-side). */
export async function getFlowToken(): Promise<string> {
  return randomUUID();
}
