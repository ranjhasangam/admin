import { randomBytes } from "node:crypto";
import { getGuardedAdmin } from "@/lib/auth-guard";
import { createServiceClient } from "@/lib/supabase/service";
import type { AdminMe, Permission, Role } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

export const VALID_ROLES: Role[] = ["super_admin", "admin", "support"];

export type ApiGuard =
  | { ok: true; supabase: SupabaseClient; admin: AdminMe; service: ReturnType<typeof createServiceClient> }
  | { ok: false; response: NextResponse };

/**
 * Guard for service-role API routes:
 *  1. Cookie-based auth + active admin profile + permission (DB-enforced).
 *  2. Only THEN is the service-role client handed to the route.
 * The service-role key never reaches the browser.
 */
export async function requireSuperAdminApi(
  perm: Permission,
  json: (body: unknown, status: number) => NextResponse
): Promise<ApiGuard> {
  const guard = await getGuardedAdmin(perm);
  if (!guard.ok) return { ok: false, response: json({ error: guard.error }, guard.status ?? 403) };
  try {
    const service = createServiceClient();
    return { ok: true, supabase: guard.supabase, admin: guard.admin, service };
  } catch {
    return {
      ok: false,
      response: json(
        { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY — admin management is disabled until it is set." },
        500
      ),
    };
  }
}

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Cryptographically strong password, avoids ambiguous characters. */
export function generatePassword(length = 16): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function isValidPassword(pw: string): boolean {
  return pw.length >= 10 && pw.length <= 128;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Writes an audit entry through the service client (server-side actions). */
export async function auditViaService(
  service: ReturnType<typeof createServiceClient>,
  admin: AdminMe,
  action: string,
  section: string,
  recordId: string | null,
  details: Record<string, unknown>
) {
  try {
    await service.from("admin_audit_logs").insert({
      admin_id: admin.id,
      admin_email: admin.email,
      action,
      section,
      record_id: recordId,
      details,
    });
  } catch (e) {
    console.error("[admin-panel] audit insert failed:", e);
  }
}

/** Blocks removing/deactivating/demoting the last active Super Admin. */
export async function isLastActiveSuperAdmin(
  service: ReturnType<typeof createServiceClient>,
  targetId: string
): Promise<boolean> {
  const { data } = await service
    .from("admin_profiles")
    .select("id")
    .eq("role", "super_admin")
    .eq("is_active", true);
  const actives = (data ?? []) as { id: string }[];
  return actives.length <= 1 && actives.some((a) => a.id === targetId);
}
