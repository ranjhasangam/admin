import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { Paged, SessionRow } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { SessionsExplorer } from "@/components/sessions/sessions-explorer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Website Sessions" };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_sessions")) return <NoAccess permission="view_sessions" title="Website Sessions" />;

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const activeParam = one("active");
  const q = one("q")?.trim() || null;
  const page = Math.max(1, parseInt(one("page") || "1", 10) || 1);

  const [statsRes, listRes] = await Promise.all([
    supabase.rpc("admin_session_stats"),
    supabase.rpc("admin_list_sessions", {
      p_active_only: activeParam === "1" ? true : activeParam === "0" ? false : null,
      p_search: q,
      p_page: page,
      p_page_size: 20,
    }),
  ]);

  if (listRes.error || !listRes.data) {
    logRpcError("admin_list_sessions", listRes.error);
    return <RpcError message={rpcErrorText(listRes.error)} retryHref="/sessions" />;
  }

  return (
    <>
      <PageHeader
        title="Website Sessions"
        subtitle="Reads the existing website_sessions table — the main website's session tracking logic is untouched. Only hashed identifiers are shown; no raw IPs."
      />
      <SessionsExplorer
        stats={(statsRes.data ?? { total: 0, active: 0, today: 0, last7: 0, last30: 0 }) as {
          total: number; active: number; today: number; last7: number; last30: number;
        }}
        pageData={listRes.data as Paged<SessionRow>}
      />
    </>
  );
}
