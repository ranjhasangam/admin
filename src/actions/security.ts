"use server";

import { revalidatePath } from "next/cache";
import { getGuardedAdmin } from "@/lib/auth-guard";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { ActionResult } from "@/lib/types";

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
const HASH_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Blocks an IP by storing ONLY its hash (same hashing architecture as the
 * existing rate limiter — spec §28). Enforcement happens in the database
 * via the admin_block_ip_guard trigger on the existing request tables,
 * BEFORE any row is inserted (spec §29).
 */
export async function blockIp(input: {
  ip: string;
  reason?: string | null;
  label?: string | null;
  expires_at?: string | null;
}): Promise<ActionResult> {
  const guard = await getGuardedAdmin("manage_blocked_ips");
  if (!guard.ok) return { ok: false, error: guard.error };

  const ip = (input.ip || "").trim();
  if (!ip) return { ok: false, error: "Enter an IP address (or a 64-char hash)." };
  if (!IP_RE.test(ip) && !HASH_RE.test(ip)) {
    return { ok: false, error: "That does not look like a valid IPv4/IPv6 address or SHA-256 hash." };
  }

  const { error } = await guard.supabase.rpc("admin_block_ip", {
    p_ip: ip,
    p_reason: input.reason?.trim() || null,
    p_label: input.label?.trim() || null,
    p_expires_at: input.expires_at || null,
  });
  if (error) {
    logRpcError("admin_block_ip", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidatePath("/security/blocked-ips");
  revalidatePath("/dashboard");
  return { ok: true, message: "IP blocked. New requests from it are rejected before insertion." };
}

export async function unblockIp(id: string): Promise<ActionResult> {
  const guard = await getGuardedAdmin("manage_blocked_ips");
  if (!guard.ok) return { ok: false, error: guard.error };

  const { error } = await guard.supabase.rpc("admin_unblock_ip", { p_id: id });
  if (error) {
    logRpcError("admin_unblock_ip", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidatePath("/security/blocked-ips");
  revalidatePath("/dashboard");
  return { ok: true, message: "IP unblocked. It can submit requests again (existing 5/hour rate limit still applies)." };
}

export async function deleteBlockedIp(id: string): Promise<ActionResult> {
  const guard = await getGuardedAdmin("manage_blocked_ips");
  if (!guard.ok) return { ok: false, error: guard.error };

  const { error } = await guard.supabase.rpc("admin_delete_blocked_ip", { p_id: id });
  if (error) {
    logRpcError("admin_delete_blocked_ip", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidatePath("/security/blocked-ips");
  revalidatePath("/dashboard");
  return { ok: true, message: "Blocked-IP record removed." };
}
