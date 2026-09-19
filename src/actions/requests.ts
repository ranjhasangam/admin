"use server";

import { revalidatePath } from "next/cache";
import { getGuardedAdmin } from "@/lib/auth-guard";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { ActionResult, RequestType } from "@/lib/types";

export interface RequestRef {
  type: RequestType;
  id: string;
}

const VALID_STATUS = ["pending", "completed", "cancelled"] as const;

function revalidateRequestPaths() {
  revalidatePath("/requests", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

/** Single status change → updates the EXISTING Supabase record (spec §16). */
export async function updateRequestStatus(
  type: RequestType,
  id: string,
  status: (typeof VALID_STATUS)[number]
): Promise<ActionResult> {
  const guard = await getGuardedAdmin("update_status");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!VALID_STATUS.includes(status)) return { ok: false, error: "Invalid status." };

  const { error } = await guard.supabase.rpc("admin_set_request_status", {
    p_type: type,
    p_id: id,
    p_status: status,
  });
  if (error) {
    logRpcError("admin_set_request_status", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidateRequestPaths();
  return { ok: true, message: `Request marked ${status}.` };
}

/** Delete a single request (confirmation happens in the UI — spec §17). */
export async function deleteRequest(type: RequestType, id: string): Promise<ActionResult> {
  const guard = await getGuardedAdmin("delete_requests");
  if (!guard.ok) return { ok: false, error: guard.error };

  const { error } = await guard.supabase.rpc("admin_delete_request", { p_type: type, p_id: id });
  if (error) {
    logRpcError("admin_delete_request", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidateRequestPaths();
  return { ok: true, message: "Request deleted (snapshot kept in the audit log)." };
}

/** Bulk status change for selected rows (spec §25). */
export async function bulkUpdateStatus(
  items: RequestRef[],
  status: (typeof VALID_STATUS)[number]
): Promise<ActionResult> {
  const guard = await getGuardedAdmin("update_status");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!items.length) return { ok: false, error: "No requests selected." };
  if (!VALID_STATUS.includes(status)) return { ok: false, error: "Invalid status." };

  const { data, error } = await guard.supabase.rpc("admin_bulk_request_status", {
    p_items: items.map((i) => ({ type: i.type, id: i.id })),
    p_status: status,
  });
  if (error) {
    logRpcError("admin_bulk_request_status", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidateRequestPaths();
  const updated = (data as { updated?: number } | null)?.updated ?? items.length;
  return { ok: true, message: `${updated} request${updated === 1 ? "" : "s"} marked ${status}.` };
}

/** Bulk delete — the UI requires typing DELETE before this runs (spec §25). */
export async function bulkDeleteRequests(items: RequestRef[]): Promise<ActionResult> {
  const guard = await getGuardedAdmin("delete_requests");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!items.length) return { ok: false, error: "No requests selected." };

  const { data, error } = await guard.supabase.rpc("admin_bulk_delete_requests", {
    p_items: items.map((i) => ({ type: i.type, id: i.id })),
  });
  if (error) {
    logRpcError("admin_bulk_delete_requests", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidateRequestPaths();
  const deleted = (data as { deleted?: number } | null)?.deleted ?? 0;
  return { ok: true, message: `${deleted} request${deleted === 1 ? "" : "s"} deleted permanently.` };
}
