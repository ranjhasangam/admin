"use server";

import { revalidatePath } from "next/cache";
import { getGuardedAdmin } from "@/lib/auth-guard";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { ActionResult } from "@/lib/types";

/** Admin updates their own display name. */
export async function updateOwnName(fullName: string): Promise<ActionResult> {
  const guard = await getGuardedAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const name = (fullName || "").trim();
  if (!name) return { ok: false, error: "Name cannot be empty." };
  if (name.length > 120) return { ok: false, error: "Name is too long (max 120 characters)." };

  const { error } = await guard.supabase.rpc("admin_update_own_profile", { p_full_name: name });
  if (error) {
    logRpcError("admin_update_own_profile", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Profile updated." };
}
