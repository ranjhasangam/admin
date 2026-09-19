import type { RequestFilters, RequestType, SortKey } from "./types";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A→Z" },
  { value: "name_desc", label: "Name Z→A" },
  { value: "status", label: "Status" },
  { value: "updated", label: "Recently updated" },
];

export const PAGE_SIZE_OPTIONS = [20, 50, 100];

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: "service", label: "Service" },
  { value: "contact", label: "Contact" },
  { value: "callback", label: "Callback" },
];

const VALID_TYPES: RequestType[] = ["service", "contact", "callback"];
const VALID_SORTS: SortKey[] = ["newest", "oldest", "name_asc", "name_desc", "status", "updated"];

type SearchParamsLike = Record<string, string | string[] | undefined>;

function one(sp: SearchParamsLike, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function list(sp: SearchParamsLike, key: string): string[] | null {
  const v = one(sp, key);
  if (!v) return null;
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : null;
}

/**
 * Parses URL search params into strongly-typed request filters.
 * Used BOTH by the requests pages and by the /api/export route, so an
 * export ALWAYS matches exactly what is filtered on screen (spec §23).
 */
export function parseRequestFilters(
  sp: SearchParamsLike,
  scope: "all" | RequestType
): RequestFilters {
  const q = one(sp, "q")?.trim() || null;
  const statuses = list(sp, "status");
  const sortRaw = (one(sp, "sort") as SortKey) || "newest";
  const sort: SortKey = VALID_SORTS.includes(sortRaw) ? sortRaw : "newest";
  const page = Math.max(1, parseInt(one(sp, "page") || "1", 10) || 1);
  const sizeRaw = parseInt(one(sp, "size") || "20", 10);
  const page_size = PAGE_SIZE_OPTIONS.includes(sizeRaw) ? sizeRaw : 20;

  // Type filter: on /requests (scope=all) the "type" param drives it;
  // on the dedicated pages the scope fixes the type.
  let types: RequestType[] | null = null;
  if (scope !== "all") {
    types = [scope];
  } else {
    const requested = list(sp, "type");
    if (requested) {
      const valid = requested.filter((t): t is RequestType => VALID_TYPES.includes(t as RequestType));
      if (valid.length && valid.length < VALID_TYPES.length) types = valid;
    }
  }

  return {
    scope,
    types,
    statuses,
    search: q,
    date_from: one(sp, "from") || null,
    date_to: one(sp, "to") || null,
    service: one(sp, "service") || null,
    source: one(sp, "source") || null,
    sort,
    page,
    page_size,
  };
}

/** Serializes filters back into URL params (pagination / links / exports). */
export function filtersToSearchParams(f: RequestFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.search) p.set("q", f.search);
  if (f.statuses?.length) p.set("status", f.statuses.join(","));
  if (f.scope === "all" && f.types?.length) p.set("type", f.types.join(","));
  if (f.date_from) p.set("from", f.date_from);
  if (f.date_to) p.set("to", f.date_to);
  if (f.service) p.set("service", f.service);
  if (f.source) p.set("source", f.source);
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  if (f.page_size !== 20) p.set("size", String(f.page_size));
  return p;
}

/** Arguments for the admin_list_requests RPC. */
export function listRequestsArgs(f: RequestFilters) {
  return {
    p_types: f.types && f.types.length ? f.types : null,
    p_statuses: f.statuses && f.statuses.length ? f.statuses : null,
    p_search: f.search,
    p_date_from: f.date_from,
    p_date_to: f.date_to,
    p_service: f.service,
    p_source: f.source,
    p_sort: f.sort,
    p_page: f.page,
    p_page_size: f.page_size,
    p_ids: null as string[] | null,
  };
}

/** Arguments for the admin_export_requests RPC (no pagination). */
export function exportRequestsArgs(f: RequestFilters, ids?: string[] | null) {
  return {
    p_types: f.types && f.types.length ? f.types : null,
    p_statuses: f.statuses && f.statuses.length ? f.statuses : null,
    p_search: f.search,
    p_date_from: f.date_from,
    p_date_to: f.date_to,
    p_service: f.service,
    p_source: f.source,
    p_sort: f.sort,
    p_ids: ids && ids.length ? ids : null,
  };
}
