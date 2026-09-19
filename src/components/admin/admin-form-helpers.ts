import type { Role } from "@/lib/types";

export interface AdminPayload {
  email: string;
  full_name: string | null;
  role: Role;
  can_delete_requests: boolean;
  can_update_status: boolean;
  password?: string;
}

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Client-side password *suggestion* generator for the manual mode.
 * The authoritative generation for auto-passwords happens SERVER-side
 * (node:crypto in /api/admins) — this is only a UI convenience.
 */
export function generatePasswordHint(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
