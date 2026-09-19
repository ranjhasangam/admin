import { NextResponse } from "next/server";
import {
  EMAIL_RE, VALID_ROLES, auditViaService, generatePassword,
  isValidPassword, requireSuperAdminApi,
} from "@/lib/api-helpers";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) => NextResponse.json(body, { status });

/**
 * POST /api/admins — Super Admin creates a new administrator (spec §8).
 * Body: { email, password?, full_name?, role, can_delete_requests?, can_update_status? }
 * Uses the service role SERVER-SIDE to create the Supabase Auth user in the
 * SAME project, then links an admin_profiles row. No admin credentials or
 * service keys ever reach the browser.
 */
export async function POST(req: Request) {
  const guard = await requireSuperAdminApi("manage_admins", json);
  if (!guard.ok) return guard.response;
  const { admin, service } = guard;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim() || null;
  const role = String(body.role ?? "admin") as Role;
  const canDelete = Boolean(body.can_delete_requests);
  const canUpdateStatus = body.can_update_status === undefined ? true : Boolean(body.can_update_status);
  const generate = body.password === undefined || body.password === "";
  const password = generate ? generatePassword(16) : String(body.password);

  if (!EMAIL_RE.test(email)) return json({ error: "A valid email address is required." }, 400);
  if (!VALID_ROLES.includes(role)) return json({ error: "Invalid role." }, 400);
  if (!isValidPassword(password)) {
    return json({ error: "Password must be at least 10 characters (or leave empty to auto-generate)." }, 400);
  }
  if (email === admin.email) {
    return json({ error: "You already exist — use Settings to change your own credentials." }, 400);
  }

  // 1) Create the auth user in the SAME Supabase project.
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, created_by: admin.email },
  });
  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? "").toLowerCase();
    if (msg.includes("already been registered") || msg.includes("already exists")) {
      return json({ error: "That email is already registered in Supabase Auth. If it is an existing user, promote them instead (see README §Admin Management)." }, 409);
    }
    console.error("[admin-panel] createUser:", createErr);
    return json({ error: "Could not create the auth user. Check server logs." }, 500);
  }

  // 2) Link the admin profile (role + permission flags).
  const { error: profileErr } = await service.from("admin_profiles").upsert(
    {
      id: created.user.id,
      email,
      full_name: fullName,
      role,
      is_active: true,
      can_delete_requests: canDelete,
      can_update_status: canUpdateStatus,
    },
    { onConflict: "id" }
  );
  if (profileErr) {
    // Roll back the auth user so we never leave an orphan without a profile.
    await service.auth.admin.deleteUser(created.user.id);
    console.error("[admin-panel] profile insert:", profileErr);
    return json({ error: "Auth user created but profile failed (rolled back). Try again." }, 500);
  }

  await auditViaService(service, admin, "admin.created", "admin_users", created.user.id, {
    email, role, full_name: fullName, can_delete_requests: canDelete, can_update_status: canUpdateStatus,
  });

  return json(
    {
      ok: true,
      admin: {
        id: created.user.id, email, full_name: fullName, role,
        is_active: true, can_delete_requests: canDelete, can_update_status: canUpdateStatus,
      },
      // Shown ONCE in the UI, never stored anywhere:
      generated_password: generate ? password : undefined,
    },
    201
  );
}
