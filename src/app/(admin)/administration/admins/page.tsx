import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { AdminUserRow } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { AdminsManager } from "@/components/admin/admins-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Users" };

export default async function AdminUsersPage() {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "manage_admins")) return <NoAccess permission="manage_admins" title="Admin Users" />;

  const { data, error } = await supabase.rpc("admin_list_admins");
  if (error) {
    logRpcError("admin_list_admins", error);
    return <RpcError message={rpcErrorText(error)} retryHref="/administration/admins" />;
  }

  return (
    <>
      <PageHeader
        title="Admin Users"
        subtitle="Create, activate, deactivate, re-role, reset and remove administrators — all inside the same Supabase project. No Supabase Dashboard round-trips needed."
      />
      <AdminsManager admins={(data ?? []) as AdminUserRow[]} currentAdmin={admin} />
    </>
  );
}
