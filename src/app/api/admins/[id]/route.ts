import { NextResponse } from "next/server";
import {
  VALID_ROLES, auditViaService, isLastActiveSuperAdmin, requireSuperAdminApi,
} from "@/lib/api-helpers";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) => NextResponse.json(body, { status });

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admins/:id — update role / flags / active state / name. */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireSuperAdminApi("manage_admins", json);
  if (!guard.ok) return guard.response;
  const { admin, service } = guard;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  // Load current profile.
  const { data: current, error: fetchErr } = await service
    .from("admin_profiles").select("*").eq("id", id).maybeSingle();
  if (fetchErr || !current) return json({ error: "Admin not found." }, 404);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changes: Record<string, unknown> = {};

  if (body.full_name !== undefined) {
    const name = String(body.full_name ?? "").trim() || null;
    patch.full_name = name; changes.full_name = name;
  }
  if (body.role !== undefined) {
    const role = String(body.role) as Role;
    if (!VALID_ROLES.includes(role)) return json({ error: "Invalid role." }, 400);
    patch.role = role; changes.role = role;
  }
  if (body.is_active !== undefined) {
    patch.is_active = Boolean(body.is_active); changes.is_active = patch.is_active;
  }
  if (body.can_delete_requests !== undefined) {
    patch.can_delete_requests = Boolean(body.can_delete_requests);
    changes.can_delete_requests = patch.can_delete_requests;
  }
  if (body.can_update_status !== undefined) {
    patch.can_update_status = Boolean(body.can_update_status);
    changes.can_update_status = patch.can_update_status;
  }
  if (!Object.keys(changes).length) return json({ error: "Nothing to update." }, 400);

  // Safety rails.
  const effectiveRole = (patch.role as Role) ?? (current.role as Role);
  const effectiveActive = patch.is_active !== undefined ? Boolean(patch.is_active) : current.is_active;
  const wasSuperActive = current.role === "super_admin" && current.is_active;

  if (id === admin.id && (effectiveRole !== "super_admin" || !effectiveActive)) {
    return json({ error: "You cannot demote or deactivate your own account." }, 400);
  }
  if (wasSuperActive && (effectiveRole !== "super_admin" || !effectiveActive)) {
    if (await isLastActiveSuperAdmin(service, id)) {
      return json({ error: "At least one active Super Admin must remain." }, 400);
    }
  }

  const { error } = await service.from("admin_profiles").update(patch).eq("id", id);
  if (error) {
    console.error("[admin-panel] update profile:", error);
    return json({ error: "Update failed." }, 500);
  }

  // Deactivating: end that admin's live sessions immediately.
  if (patch.is_active === false) {
    try { await service.auth.admin.signOut(id, "global"); } catch { /* best effort */ }
  }

  const action =
    patch.is_active === false ? "admin.deactivated" :
    patch.is_active === true ? "admin.activated" : "admin.updated";
  await auditViaService(service, admin, action, "admin_users", id, {
    email: current.email, ...changes,
  });

  return json({ ok: true }, 200);
}

/** DELETE /api/admins/:id — remove profile + auth user (strong confirm in UI). */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requireSuperAdminApi("manage_admins", json);
  if (!guard.ok) return guard.response;
  const { admin, service } = guard;
  const { id } = await params;

  if (id === admin.id) {
    return json({ error: "You cannot delete your own account." }, 400);
  }

  const { data: current } = await service
    .from("admin_profiles").select("*").eq("id", id).maybeSingle();
  if (!current) return json({ error: "Admin not found." }, 404);

  if (current.role === "super_admin" && current.is_active) {
    if (await isLastActiveSuperAdmin(service, id)) {
      return json({ error: "At least one active Super Admin must remain." }, 400);
    }
  }

  const { error: profileErr } = await service.from("admin_profiles").delete().eq("id", id);
  if (profileErr) {
    console.error("[admin-panel] delete profile:", profileErr);
    return json({ error: "Could not remove the admin profile." }, 500);
  }
  try {
    await service.auth.admin.deleteUser(id);
  } catch (e) {
    console.error("[admin-panel] delete auth user (profile already removed):", e);
  }

  await auditViaService(service, admin, "admin.deleted", "admin_users", id, {
    email: current.email, role: current.role,
  });

  return json({ ok: true }, 200);
}
