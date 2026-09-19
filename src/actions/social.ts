"use server";

import { revalidatePath } from "next/cache";
import { getGuardedAdmin } from "@/lib/auth-guard";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { ActionResult } from "@/lib/types";

export interface SocialLinkInput {
  id?: string | null;
  platform: string;
  url: string;
  label?: string | null;
  is_visible?: boolean;
  sort_order?: number;
}

/**
 * Social links are website URLs ONLY. Passwords are never requested,
 * never accepted and never stored (spec §34).
 */
export async function upsertSocialLink(input: SocialLinkInput): Promise<ActionResult> {
  const guard = await getGuardedAdmin("manage_settings");
  if (!guard.ok) return { ok: false, error: guard.error };

  const platform = (input.platform || "").trim().toLowerCase();
  const url = (input.url || "").trim();
  if (!platform) return { ok: false, error: "Platform is required." };
  if (!url) return { ok: false, error: "URL is required." };
  if (/(password|passwd|pwd|secret|token)/i.test(platform + url + (input.label ?? ""))) {
    return { ok: false, error: "Never store social-media passwords or secrets — URLs only." };
  }

  const { error } = await guard.supabase.rpc("admin_upsert_social_link", {
    p_id: input.id ?? null,
    p_platform: platform,
    p_url: url,
    p_label: input.label?.trim() || null,
    p_is_visible: input.is_visible ?? true,
    p_sort_order: input.sort_order ?? 0,
  });
  if (error) {
    logRpcError("admin_upsert_social_link", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidatePath("/website/social");
  return { ok: true, message: input.id ? "Social link updated." : "Social link added." };
}

export async function toggleSocialLinkVisibility(
  id: string,
  platform: string,
  url: string,
  label: string | null,
  sortOrder: number,
  visible: boolean
): Promise<ActionResult> {
  return upsertSocialLink({ id, platform, url, label, is_visible: visible, sort_order: sortOrder });
}

export async function deleteSocialLink(id: string, platform: string): Promise<ActionResult> {
  const guard = await getGuardedAdmin("manage_settings");
  if (!guard.ok) return { ok: false, error: guard.error };

  const { error } = await guard.supabase.rpc("admin_delete_social_link", { p_id: id });
  if (error) {
    logRpcError("admin_delete_social_link", error);
    return { ok: false, error: rpcErrorText(error) };
  }

  revalidatePath("/website/social");
  return { ok: true, message: `Social link “${platform}” deleted.` };
}
