import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { AuditRow, Paged } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { AuditExplorer } from "@/components/audit/audit-explorer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_audit")) return <NoAccess permission="view_audit" title="Audit Logs" />;

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(one("page") || "1", 10) || 1);

  const { data, error } = await supabase.rpc("admin_list_audit_logs", {
    p_search: one("q")?.trim() || null,
    p_section: one("section") || null,
    p_page: page,
    p_page_size: 20,
  });

  if (error || !data) {
    logRpcError("admin_list_audit_logs", error);
    return <RpcError message={rpcErrorText(error)} retryHref="/administration/audit" />;
  }

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="Every important admin action — logins, status changes, deletes, IP blocks, settings changes, admin management — with who, what and when. Passwords are never stored."
      />
      <AuditExplorer pageData={data as Paged<AuditRow>} />
    </>
  );
}
