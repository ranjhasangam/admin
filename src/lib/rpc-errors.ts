import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Translates database errors into safe, human-readable messages.
 * Raw database errors are NEVER shown to users (spec §43).
 */
export function rpcErrorText(error: PostgrestError | { message?: string; code?: string; details?: string; hint?: string } | null): string {
  if (!error) return "Unknown error.";
  const raw = (error.message || "").toLowerCase();

  if (error.code === "42501" || raw.includes("insufficient_permission")) {
    return "You do not have permission to perform this action.";
  }
  if (raw.includes("request_not_found") || error.code === "P0002") {
    return "This record no longer exists — it may have been deleted by another admin.";
  }
  if (raw.includes("invalid_status")) {
    return "Invalid status. Allowed values: pending, completed, cancelled.";
  }
  if (raw.includes("invalid_request_type")) {
    return "Unknown request type.";
  }
  if (raw.includes("invalid_url")) {
    return error.hint || "Please enter a valid URL (https://, wa.me/, mailto: or tel:).";
  }
  if (raw.includes("invalid_platform")) {
    return "Please enter a platform name (e.g. instagram, facebook).";
  }
  if (raw.includes("invalid_setting_key")) {
    return "Unknown settings field.";
  }
  if (raw.includes("social_link_not_found") || raw.includes("blocked_ip_not_found")) {
    return "This record no longer exists.";
  }
  if (raw.includes("ip_required")) {
    return "Please enter an IP address or hash to block.";
  }
  if (raw.includes("bootstrap_locked")) {
    return "A Super Admin already exists — manage admins from the Admin Panel.";
  }
  if (raw.includes("auth_user_not_found")) {
    return "That auth user does not exist yet. Create it in Supabase Dashboard → Authentication → Users.";
  }
  if (raw.includes("request_blocked_ip")) {
    return "Rejected by the blocked-IP guard.";
  }
  if (error.code === "22023") {
    return error.hint || error.details || "Invalid input.";
  }
  if (raw.includes("failed to fetch") || raw.includes("fetch failed") || error.code === "PGRST301") {
    return "Could not reach the database. Check the connection and retry.";
  }
  if (raw.includes("jwt") || raw.includes("token")) {
    return "Your session is no longer valid. Please sign in again.";
  }
  return "Something went wrong while processing this operation. Please retry.";
}

/** Console-log the raw error for the operator, without exposing it to users. */
export function logRpcError(where: string, error: unknown) {
  console.error(`[admin-panel] ${where}:`, error);
}
