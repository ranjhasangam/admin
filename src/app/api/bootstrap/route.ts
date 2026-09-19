import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { bootstrapEmail, bootstrapPassword, hasServiceRole } from "@/lib/env";
import { EMAIL_RE, isValidPassword } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) => NextResponse.json(body, { status });

/**
 * OPTIONAL headless bootstrap of the FIRST Super Admin (spec §46 step 5).
 * Disabled (404) unless ADMIN_BOOTSTRAP_EMAIL is set on the server.
 * Works only while NO active super_admin exists — after that it is inert.
 *
 * The SQL bootstrap (SELECT public.bootstrap_first_super_admin('email'))
 * remains the recommended path; this route is a convenience for automation.
 */
export async function POST(req: Request) {
  if (!bootstrapEmail || !hasServiceRole) {
    return json({ error: "Bootstrap is disabled. Use the SQL bootstrap instead." }, 404);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* fallthrough validation */ }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? bootstrapPassword ?? "");

  if (email !== bootstrapEmail.toLowerCase()) {
    return json({ error: "Email does not match ADMIN_BOOTSTRAP_EMAIL." }, 403);
  }
  if (!EMAIL_RE.test(email)) return json({ error: "Invalid email." }, 400);
  if (!isValidPassword(password)) {
    return json({ error: "Password must be at least 10 characters." }, 400);
  }

  const service = createServiceClient();

  // Only while no active Super Admin exists.
  const { data: supers } = await service
    .from("admin_profiles").select("id").eq("role", "super_admin").eq("is_active", true).limit(1);
  if ((supers ?? []).length > 0) {
    return json({ error: "A Super Admin already exists. Bootstrap is locked." }, 403);
  }

  // Reuse existing auth user or create a new one.
  let userId: string | null = null;
  const { data: listed } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    await service.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  } else {
    const { data: created, error } = await service.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: "Super Admin", bootstrap: true },
    });
    if (error || !created?.user) {
      console.error("[admin-panel] bootstrap createUser:", error);
      return json({ error: "Could not create the auth user." }, 500);
    }
    userId = created.user.id;
  }

  const { error: profileErr } = await service.from("admin_profiles").upsert(
    {
      id: userId, email, full_name: "Super Admin", role: "super_admin",
      is_active: true, can_delete_requests: true, can_update_status: true,
    },
    { onConflict: "id" }
  );
  if (profileErr) {
    console.error("[admin-panel] bootstrap profile:", profileErr);
    return json({ error: "Could not create the admin profile." }, 500);
  }

  await service.from("admin_audit_logs").insert({
    admin_id: userId, admin_email: email,
    action: "admin.bootstrap", section: "admin_users",
    record_id: userId, details: { method: "api_bootstrap" },
  });

  return json({ ok: true, message: `Super Admin ready: ${email}` }, 201);
}
