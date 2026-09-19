import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { listRequestsArgs, parseRequestFilters } from "@/lib/query";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { FilterOptions, Paged, RequestRow, RequestType } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { RpcError } from "@/components/ui/rpc-error";
import { NoAccess } from "@/components/ui/no-access";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RequestsClient } from "./requests-client";

type SP = Record<string, string | string[] | undefined>;

/**
 * Shared server data-layer for all four request views.
 * Pagination / search / filters run INSIDE the database (spec §18, §19, §21) —
 * only the current page of rows travels to the browser.
 */
export async function RequestsPageServer({
  scope,
  title,
  subtitle,
  searchParams,
}: {
  scope: "all" | RequestType;
  title: string;
  subtitle: string;
  searchParams: Promise<SP>;
}) {
  const { supabase, admin } = await requireAdmin();

  if (!can(admin, "view_requests")) {
    return <NoAccess permission="view_requests" title={title} />;
  }

  const sp = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) flat[k] = Array.isArray(v) ? v[0] : v;

  const filters = parseRequestFilters(flat, scope);

  const [listRes, optsRes] = await Promise.all([
    supabase.rpc("admin_list_requests", listRequestsArgs(filters)),
    supabase.rpc("admin_filter_options"),
  ]);

  if (listRes.error || !listRes.data) {
    logRpcError("admin_list_requests", listRes.error);
    return <RpcError message={rpcErrorText(listRes.error)} retryHref="/dashboard" backHref="/dashboard" backLabel="Dashboard" />;
  }

  const options = (optsRes.data ?? {
    services: [], sources: [], statuses: [], date_min: null, date_max: null,
  }) as FilterOptions;

  return (
    <>
      <RealtimeRefresh />
      <PageHeader title={title} subtitle={subtitle} />
      <RequestsClient
        scope={scope}
        page={listRes.data as Paged<RequestRow>}
        filters={filters}
        options={options}
        admin={admin}
      />
    </>
  );
}
