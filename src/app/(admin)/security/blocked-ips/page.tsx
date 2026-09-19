import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { BlockedIpRow, Paged } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { BlockedIpsManager } from "@/components/security/blocked-ips-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blocked IPs" };

export default async function BlockedIpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_blocked_ips")) {
    return <NoAccess permission="view_blocked_ips" title="Blocked IPs" />;
  }

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, parseInt(one("page") || "1", 10) || 1);
  const q = one("q")?.trim() || null;
  const activeOnly = (one("active") ?? "1") === "1";

  const { data, error } = await supabase.rpc("admin_list_blocked_ips", {
    p_active_only: activeOnly,
    p_search: q,
    p_page: page,
    p_page_size: 20,
  });

  if (error || !data) {
    logRpcError("admin_list_blocked_ips", error);
    return <RpcError message={rpcErrorText(error)} retryHref="/security/blocked-ips" />;
  }

  return (
    <>
      <PageHeader
        title="Blocked IPs"
        subtitle="Database-level enforcement: blocked visitors are rejected by a trigger on the existing request tables BEFORE any record is inserted. Only hashes are stored — never raw IPs."
      />
      <BlockedIpsManager
        pageData={data as Paged<BlockedIpRow>}
        canManage={can(admin, "manage_blocked_ips")}
      />
    </>
  );
}
