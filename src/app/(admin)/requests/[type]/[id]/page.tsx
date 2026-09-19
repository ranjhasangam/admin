import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { RequestType } from "@/lib/types";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { RequestDetailView, type RequestPayload } from "@/components/requests/request-detail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request details" };

const VALID_TYPES = ["service", "contact", "callback"];

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  if (!VALID_TYPES.includes(type) || !id) notFound();

  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_requests")) {
    return <NoAccess permission="view_requests" title="Request details" />;
  }

  const { data, error } = await supabase.rpc("admin_get_request", {
    p_type: type,
    p_id: id,
  });

  if (error || !data) {
    logRpcError("admin_get_request", error);
    return (
      <RpcError
        message={rpcErrorText(error)}
        backHref={`/requests/${type}`}
        backLabel={`Back to ${type} requests`}
      />
    );
  }

  return <RequestDetailView payload={data as RequestPayload} admin={admin} />;
}

export type { RequestType };
