"use server";

import { revalidatePath } from "next/cache";
import { getGuardedAdmin } from "@/lib/auth-guard";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import { isValidEmail } from "@/lib/format";
import type { ActionResult, SettingKey } from "@/lib/types";
import { SETTINGS_KEYS } from "@/lib/types";

const ALLOWED_KEYS: readonly string[] = SETTINGS_KEYS;

/**
 * Saves website settings (business info / contact info) to the SAME
 * Supabase project. The main website reads them via get_website_settings()
 * and updates automatically — no redeploy needed (spec §35).
 */
export async function saveSettings(entries: Record<string, string>): Promise<ActionResult> {
  const guard = await getGuardedAdmin("manage_settings");
  if (!guard.ok) return { ok: false, error: guard.error };

  const keys = Object.keys(entries).filter((k) => ALLOWED_KEYS.includes(k));
  if (!keys.length) return { ok: false, error: "Nothing to save." };

  // Light server-side validation (the DB enforces the key whitelist too).
  if ("email" in entries && entries.email && !isValidEmail(entries.email)) {
    return { ok: false, error: "Please enter a valid business email address." };
  }
  if ("whatsapp" in entries && entries.whatsapp) {
    const digits = entries.whatsapp.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      return { ok: false, error: "WhatsApp number looks invalid — include the country code (e.g. +91…)." };
    }
  }

  let saved = 0;
  for (const key of keys as SettingKey[]) {
    const value = (entries[key] ?? "").trim();
    const { error } = await guard.supabase.rpc("admin_set_setting", { p_key: key, p_value: value });
    if (error) {
      logRpcError(`admin_set_setting(${key})`, error);
      return {
        ok: false,
        error: `Could not save “${key}”: ${rpcErrorText(error)}${saved ? ` (${saved} field(s) were saved before the error)` : ""}`,
      };
    }
    saved += 1;
  }

  revalidatePath("/website", "layout");
  revalidatePath("/settings");
  return { ok: true, message: `Saved ${saved} field${saved === 1 ? "" : "s"}. The main website picks this up automatically.` };
}
