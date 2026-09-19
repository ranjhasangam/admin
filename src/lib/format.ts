import type { RequestRow } from "./types";

/** Deterministic, timezone-safe formatters used for EXPORT FILES (server side). */

export function cleanIsoDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // "2026-09-19T16:32:10.123456+00:00" → "2026-09-19 16:32:10 UTC"
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (!m) return iso;
  const isUtc = iso.endsWith("+00:00") || iso.endsWith("Z");
  return `${m[1]} ${m[2]}${isUtc ? " UTC" : ""}`;
}

export function fileTimestamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export function maskHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return "—";
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

/** Digits-only phone for wa.me / tel links (keeps country code, drops +). */
export function phoneForLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return digits.length >= 7 ? digits : null;
}

export function waLink(phone: string | null | undefined): string | null {
  const digits = phoneForLink(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+()-]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function humanKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Rows are already normalized by the admin_all_requests read-model. */
export function requestLabel(row: RequestRow): string {
  return row.name || row.email || row.phone || `Request ${shortId(row.request_id)}`;
}
