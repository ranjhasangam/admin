import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { SocialLinkRow } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { SocialManager } from "@/components/website/social-manager";
import { PropagationNote } from "@/components/website/propagation-note";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Social Links" };

export default async function SocialLinksPage() {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_settings")) return <NoAccess permission="view_settings" title="Social Links" />;

  const { data, error } = await supabase.rpc("admin_list_social_links");
  if (error) {
    logRpcError("admin_list_social_links", error);
    return <RpcError message={rpcErrorText(error)} retryHref="/website/social" />;
  }

  return (
    <>
      <PageHeader
        title="Social Links"
        subtitle="Public profile URLs shown on the main website. Add, edit, show/hide, reorder and delete — URLs only, never passwords."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SocialManager
            links={(data ?? []) as SocialLinkRow[]}
            canManage={can(admin, "manage_settings")}
          />
        </div>
        <PropagationNote />
      </div>
    </>
  );
}
