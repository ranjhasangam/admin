import { NextResponse } from "next/server";
import {
  auditViaService, generatePassword, isValidPassword, requireSuperAdminApi,
} from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) => NextResponse.json(body, { status });

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admins/:id/reset-password
 * Body: { password? } — omit to auto-generate a strong one-time password.
 * The password is returned ONCE for the Super Admin to hand over securely;
 * it is never stored or logged (spec §39: never store passwords).
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requireSuperAdminApi("manage_admins", json);
  if (!guard.ok) return guard.response;
  const { admin, service } = guard;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow empty body → generate */ }

  const generate = body.password === undefined || body.password === "";
  const password = generate ? generatePassword(16) : String(body.password);
  if (!isValidPassword(password)) {
    return json({ error: "Password must be at least 10 characters (or leave empty to auto-generate)." }, 400);
  }
  if (id === admin.id) {
    return json({ error: "To change your OWN password, use Settings → Security." }, 400);
  }

  const { data: profile } = await service
    .from("admin_profiles").select("id, email").eq("id", id).maybeSingle();
  if (!profile) return json({ error: "Admin not found." }, 404);

  const { error } = await service.auth.admin.updateUserById(id, { password });
  if (error) {
    console.error("[admin-panel] reset password:", error);
    return json({ error: "Could not reset the password." }, 500);
  }

  // Invalidate the target admin's existing sessions so they must use the new password.
  try { await service.auth.admin.signOut(id, "global"); } catch { /* best effort */ }

  await auditViaService(service, admin, "admin.password_reset", "admin_users", id, {
    email: profile.email, generated: generate,
  });

  return json({ ok: true, password: generate ? password : undefined }, 200);
}
