"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown, Download, Eye, File, FileCode, FileSpreadsheet, FileText,
  Inbox, RefreshCw, Search, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import {
  bulkDeleteRequests, bulkUpdateStatus, deleteRequest, updateRequestStatus,
  type RequestRef,
} from "@/actions/requests";
import { useAdminAction } from "@/components/hooks/use-admin-action";
import { can } from "@/lib/permissions";
import { shortId } from "@/lib/format";
import {
  PAGE_SIZE_OPTIONS, SORT_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS,
} from "@/lib/query";
import type { AdminMe, FilterOptions, Paged, RequestFilters, RequestRow, RequestType } from "@/lib/types";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DateTime } from "@/components/ui/datetime";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";

const EXPORT_FORMATS = [
  { ext: "csv", label: "CSV", icon: <FileText className="h-4 w-4" /> },
  { ext: "xlsx", label: "Excel (.xlsx)", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { ext: "xml", label: "XML", icon: <FileCode className="h-4 w-4" /> },
  { ext: "pdf", label: "PDF", icon: <File className="h-4 w-4" /> },
] as const;

function computeRange(preset: string): { from: string | null; to: string | null } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => d.toISOString();
  const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  switch (preset) {
    case "today":
      return { from: iso(startOfToday), to: iso(plusDays(startOfToday, 1)) };
    case "yesterday":
      return { from: iso(plusDays(startOfToday, -1)), to: iso(startOfToday) };
    case "7d":
      return { from: iso(plusDays(startOfToday, -6)), to: iso(plusDays(startOfToday, 1)) };
    case "30d":
      return { from: iso(plusDays(startOfToday, -29)), to: iso(plusDays(startOfToday, 1)) };
    case "month": {
      const s = new Date(startOfToday);
      s.setDate(1);
      const e = new Date(s);
      e.setMonth(e.getMonth() + 1);
      return { from: iso(s), to: iso(e) };
    }
    default:
      return { from: null, to: null };
  }
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function RequestsClient({
  scope,
  page,
  filters,
  options,
  admin,
}: {
  scope: "all" | RequestType;
  page: Paged<RequestRow>;
  filters: RequestFilters;
  options: FilterOptions;
  admin: AdminMe;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const canUpdate = can(admin, "update_status");
  const canDelete = can(admin, "delete_requests");
  const canExport = can(admin, "export_data");

  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<RequestRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const statusAction = useAdminAction(updateRequestStatus);
  const deleteAction = useAdminAction(deleteRequest, () => setDeleteTarget(null));
  const bulkStatusAction = useAdminAction(bulkUpdateStatus);
  const bulkDeleteAction = useAdminAction(bulkDeleteRequests, () => {
    setBulkDeleteOpen(false);
    setSelected(new Set());
  });

  // Sync search box when URL changes externally (clear filters / back nav).
  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  // Debounced database-backed search (spec §18).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const current = filters.search ?? "";
    if (current === searchInput.trim()) return;
    const t = setTimeout(() => update({ q: searchInput.trim() || null }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function update(patch: Record<string, string | null>, resetPage = true) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    if (resetPage) p.delete("page");
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const rangePreset = sp.get("range") ?? (filters.date_from || filters.date_to ? "custom" : "");

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.statuses?.length ? 1 : 0) +
    (scope === "all" && filters.types?.length ? 1 : 0) +
    (filters.date_from || filters.date_to ? 1 : 0) +
    (filters.service ? 1 : 0) +
    (filters.source ? 1 : 0);

  const selectedItems: RequestRef[] = useMemo(
    () =>
      Array.from(selected).map((s) => {
        const i = s.indexOf(":");
        return { type: s.slice(0, i) as RequestType, id: s.slice(i + 1) };
      }),
    [selected]
  );

  const rowKey = (r: RequestRow) => `${r.request_type}:${r.request_id}`;
  const allPageSelected = page.rows.length > 0 && page.rows.every((r) => selected.has(rowKey(r)));

  const toggleRow = (r: RequestRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = rowKey(r);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) page.rows.forEach((r) => next.delete(rowKey(r)));
      else page.rows.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  };

  function exportUrl(format: string, selectedOnly = false): string {
    const p = new URLSearchParams(sp.toString());
    p.delete("page");
    p.delete("size");
    p.delete("range");
    p.delete("ids");
    p.set("format", format);
    p.set("scope", scope);
    if (selectedOnly) p.set("ids", Array.from(selected).join(","));
    return `/api/export?${p.toString()}`;
  }

  const download = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const detailHref = (r: RequestRow) => `/requests/${r.request_type}/${r.request_id}`;

  return (
    <div className="space-y-4">
      {/* ============ TOOLBAR ============ */}
      <Card bodyClassName="p-4 space-y-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search name, email, phone, business, service or request ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search requests"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-auto min-w-36"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })}
              aria-label="Sort"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="input w-auto min-w-24"
              value={String(filters.page_size)}
              onChange={(e) => update({ size: e.target.value === "20" ? null : e.target.value })}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s} / page</option>
              ))}
            </select>
            {canExport && (
              <Dropdown
                trigger={() => (
                  <span className="btn btn-primary">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                )}
              >
                {(close) => (
                  <div className="w-60">
                    <DropdownLabel>Filtered results ({page.total})</DropdownLabel>
                    {EXPORT_FORMATS.map((f) => (
                      <DropdownItem
                        key={f.ext}
                        icon={f.icon}
                        onClick={() => { close(); download(exportUrl(f.ext)); }}
                      >
                        {f.label}
                      </DropdownItem>
                    ))}
                    {selected.size > 0 && (
                      <>
                        <div className="my-1 border-t border-slate-100" />
                        <DropdownLabel>Selected only ({selected.size})</DropdownLabel>
                        {EXPORT_FORMATS.map((f) => (
                          <DropdownItem
                            key={`sel-${f.ext}`}
                            icon={f.icon}
                            onClick={() => { close(); download(exportUrl(f.ext, true)); }}
                          >
                            {f.label}
                          </DropdownItem>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </Dropdown>
            )}
            <button className="btn btn-secondary" onClick={() => router.refresh()} title="Refresh now" aria-label="Refresh now">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ---- filter row ---- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          </span>

          {/* status toggles */}
          <div className="flex items-center gap-1.5">
            {STATUS_OPTIONS.map((o) => {
              const active = filters.statuses?.includes(o.value) ?? false;
              const activeCls =
                o.value === "pending" ? "bg-amber-100 text-amber-800 ring-amber-300"
                : o.value === "completed" ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                : "bg-rose-100 text-rose-800 ring-rose-300";
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    const cur = new Set(filters.statuses ?? []);
                    if (cur.has(o.value)) cur.delete(o.value);
                    else cur.add(o.value);
                    update({ status: cur.size ? Array.from(cur).join(",") : null });
                  }}
                  className={`badge cursor-pointer transition ${active ? activeCls : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {/* type toggles (All Requests view only) */}
          {scope === "all" && (
            <div className="flex items-center gap-1.5">
              {TYPE_OPTIONS.map((o) => {
                const active = filters.types?.includes(o.value) ?? false;
                return (
                  <button
                    key={o.value}
                    onClick={() => {
                      const cur = new Set(filters.types ?? []);
                      if (cur.has(o.value)) cur.delete(o.value);
                      else cur.add(o.value);
                      update({ type: cur.size ? Array.from(cur).join(",") : null });
                    }}
                    className={`badge cursor-pointer transition ${active ? "bg-brand-100 text-brand-800 ring-brand-300" : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* date range */}
          <select
            className="input w-auto min-w-36 py-1.5 text-xs"
            value={rangePreset}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") {
                update({ range: "custom" });
              } else if (v === "") {
                update({ range: null, from: null, to: null });
              } else {
                const r = computeRange(v);
                update({ range: v, from: r.from, to: r.to });
              }
            }}
            aria-label="Date range"
          >
            <option value="">Any date</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom range…</option>
          </select>

          {rangePreset === "custom" && (
            <span className="flex items-center gap-1.5">
              <input
                type="datetime-local"
                className="input w-auto py-1.5 text-xs"
                value={toLocalInput(filters.date_from)}
                onChange={(e) =>
                  update({ from: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
                aria-label="From date"
              />
              <span className="text-xs text-slate-400">→</span>
              <input
                type="datetime-local"
                className="input w-auto py-1.5 text-xs"
                value={toLocalInput(filters.date_to)}
                onChange={(e) =>
                  update({ to: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
                aria-label="To date"
              />
            </span>
          )}

          {/* dynamic service + source filters */}
          {options.services.length > 0 && (
            <select
              className="input w-auto max-w-44 py-1.5 text-xs"
              value={filters.service ?? ""}
              onChange={(e) => update({ service: e.target.value || null })}
              aria-label="Service"
            >
              <option value="">All services</option>
              {options.services.map((s) => (
                <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
              ))}
            </select>
          )}
          {options.sources.length > 0 && (
            <select
              className="input w-auto max-w-44 py-1.5 text-xs"
              value={filters.source ?? ""}
              onChange={(e) => update({ source: e.target.value || null })}
              aria-label="Source section"
            >
              <option value="">All sources</option>
              {options.sources.map((s) => (
                <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
              ))}
            </select>
          )}

          {activeFilterCount > 0 && (
            <button
              className="btn btn-ghost btn-xs text-rose-600 hover:bg-rose-50"
              onClick={() => update({ q: null, status: null, type: null, range: null, from: null, to: null, service: null, source: null })}
            >
              <X className="h-3 w-3" /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </Card>

      {/* ============ BULK BAR (spec §25) ============ */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 shadow-sm animate-fade-in">
          <span className="text-sm font-semibold text-brand-800">
            {selected.size} request{selected.size > 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {canUpdate && (
              <>
                {(["pending", "completed", "cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    className="btn btn-secondary btn-sm"
                    disabled={bulkStatusAction.pending}
                    onClick={() => bulkStatusAction.run(selectedItems, s)}
                  >
                    {bulkStatusAction.pending ? <Spinner className="h-3 w-3" /> : null}
                    Mark {s}
                  </button>
                ))}
              </>
            )}
            {canExport && (
              <Dropdown
                trigger={() => (
                  <span className="btn btn-secondary btn-sm">
                    <Download className="h-3.5 w-3.5" /> Export selected <ChevronDown className="h-3 w-3" />
                  </span>
                )}
              >
                {(close) => (
                  <div className="w-48">
                    {EXPORT_FORMATS.map((f) => (
                      <DropdownItem
                        key={f.ext}
                        icon={f.icon}
                        onClick={() => { close(); download(exportUrl(f.ext, true)); }}
                      >
                        {f.label}
                      </DropdownItem>
                    ))}
                  </div>
                )}
              </Dropdown>
            )}
            {canDelete && (
              <button
                className="btn btn-danger btn-sm"
                disabled={bulkDeleteAction.pending}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ============ TABLE ============ */}
      <Card bodyClassName="p-0">
        {page.rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={activeFilterCount > 0 ? "No requests match your filters" : "No requests yet"}
            message={
              activeFilterCount > 0
                ? "Try widening the date range, clearing the search, or removing status/type filters."
                : "When customers submit service, contact or callback forms on the main website, the records appear here automatically — same Supabase tables, zero sync."
            }
            action={
              activeFilterCount > 0 ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => update({ q: null, status: null, type: null, range: null, from: null, to: null, service: null, source: null })}
                >
                  Clear all filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                  <th className="th">Request</th>
                  <th className="th">Customer</th>
                  <th className="th">Contact</th>
                  <th className="th hidden md:table-cell">Service / Message</th>
                  <th className="th hidden xl:table-cell">Source</th>
                  <th className="th hidden xl:table-cell">Price</th>
                  <th className="th">Status</th>
                  <th className="th hidden sm:table-cell">Created</th>
                  <th className="th w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((r) => (
                  <tr
                    key={rowKey(r)}
                    className="tr-hover cursor-pointer border-b border-slate-100 last:border-0"
                    onClick={() => router.push(detailHref(r))}
                  >
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
                        checked={selected.has(rowKey(r))}
                        onChange={() => toggleRow(r)}
                        aria-label={`Select request ${r.request_id}`}
                      />
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={r.request_type} />
                        <span className="font-mono text-[11px] text-slate-400" title={r.request_id}>
                          {shortId(r.request_id, 6)}
                        </span>
                      </div>
                    </td>
                    <td className="td">
                      <p className="max-w-40 truncate font-medium text-slate-800" title={r.name ?? ""}>
                        {r.name || <span className="text-slate-400">—</span>}
                      </p>
                      {r.business_name && (
                        <p className="max-w-40 truncate text-[11px] text-slate-400" title={r.business_name}>
                          {r.business_name}
                        </p>
                      )}
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-0.5 text-xs">
                        {r.email ? (
                          <a href={`mailto:${r.email}`} className="block max-w-44 truncate text-brand-600 hover:underline" title={r.email}>
                            {r.email}
                          </a>
                        ) : (
                          <span className="text-slate-300">no email</span>
                        )}
                        {r.phone ? (
                          <a href={`tel:${r.phone}`} className="block text-slate-500 hover:text-brand-600">
                            {r.phone}
                          </a>
                        ) : (
                          <span className="text-slate-300">no phone</span>
                        )}
                      </div>
                    </td>
                    <td className="td hidden md:table-cell">
                      <p className="max-w-52 truncate text-slate-600" title={r.service_name ?? r.details ?? ""}>
                        {r.service_name || "—"}
                      </p>
                      {r.details && (
                        <p className="max-w-52 truncate text-[11px] text-slate-400" title={r.details}>
                          {r.details}
                        </p>
                      )}
                    </td>
                    <td className="td hidden xl:table-cell">
                      <span className="max-w-32 truncate text-xs text-slate-500 block" title={r.source_section ?? ""}>
                        {r.source_section || "—"}
                      </span>
                    </td>
                    <td className="td hidden xl:table-cell">
                      <span className="max-w-28 truncate text-xs text-slate-500 block" title={r.price_info ?? ""}>
                        {r.price_info || "—"}
                      </span>
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      {canUpdate ? (
                        <Dropdown
                          trigger={(open) => (
                            <span className="flex cursor-pointer items-center gap-1">
                              <StatusBadge status={r.status} />
                              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                            </span>
                          )}
                        >
                          {(close) => (
                            <div className="w-44">
                              <DropdownLabel>Change status</DropdownLabel>
                              {STATUS_OPTIONS.map((o) => (
                                <DropdownItem
                                  key={o.value}
                                  disabled={o.value === (r.status ?? "").toLowerCase() || statusAction.pending}
                                  onClick={() => {
                                    close();
                                    statusAction.run(r.request_type, r.request_id, o.value as "pending" | "completed" | "cancelled");
                                  }}
                                >
                                  Mark {o.label}
                                </DropdownItem>
                              ))}
                              <div className="my-1 border-t border-slate-100" />
                              <DropdownItem
                                icon={<Eye className="h-4 w-4" />}
                                onClick={() => { close(); router.push(detailHref(r)); }}
                              >
                                View full details
                              </DropdownItem>
                            </div>
                          )}
                        </Dropdown>
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </td>
                    <td className="td hidden sm:table-cell">
                      <DateTime value={r.created_at} mode="relative" className="text-xs text-slate-500" />
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={detailHref(r)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                          title="View full request"
                          aria-label="View full request"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        {canDelete && (
                          <button
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete request"
                            aria-label="Delete request"
                            disabled={deleteAction.pending}
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page.page} pages={page.pages} total={page.total} pageSize={page.page_size} />
      </Card>

      {/* ============ DELETE CONFIRMATIONS (spec §17 / §25) ============ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this request permanently?"
        tone="danger"
        confirmLabel={deleteAction.pending ? "Deleting…" : "Delete permanently"}
        pending={deleteAction.pending}
        onConfirm={() =>
          deleteTarget && deleteAction.run(deleteTarget.request_type, deleteTarget.request_id)
        }
        onClose={() => setDeleteTarget(null)}
        message={
          deleteTarget && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
              <div className="flex items-center gap-2">
                <TypeBadge type={deleteTarget.request_type} />
                <span className="font-mono text-xs text-slate-500">{deleteTarget.request_id}</span>
              </div>
              <p><span className="text-slate-400">Customer:</span> <strong>{deleteTarget.name || "—"}</strong></p>
              {deleteTarget.email && <p className="break-all"><span className="text-slate-400">Email:</span> {deleteTarget.email}</p>}
              {deleteTarget.phone && <p><span className="text-slate-400">Phone:</span> {deleteTarget.phone}</p>}
              {deleteTarget.service_name && <p><span className="text-slate-400">Service:</span> {deleteTarget.service_name}</p>}
              <p className="pt-1 text-[11px] text-slate-400">
                The record is deleted from the existing Supabase table. A snapshot is kept in the
                audit log. This cannot be undone from the panel.
              </p>
            </div>
          )
        }
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selected.size} selected request${selected.size > 1 ? "s" : ""}?`}
        tone="danger"
        requireText="DELETE"
        confirmLabel={bulkDeleteAction.pending ? "Deleting…" : `Delete ${selected.size} permanently`}
        pending={bulkDeleteAction.pending}
        onConfirm={() => bulkDeleteAction.run(selectedItems)}
        onClose={() => setBulkDeleteOpen(false)}
        message={
          <div className="space-y-2">
            <p>
              This permanently deletes <strong>{selected.size}</strong> request record(s) from the
              existing Supabase tables:
            </p>
            <ul className="ml-4 list-disc text-xs text-slate-500">
              {(["service", "contact", "callback"] as const).map((t) => {
                const n = selectedItems.filter((i) => i.type === t).length;
                return n > 0 ? <li key={t}>{n} × {t}_requests</li> : null;
              })}
            </ul>
            <p className="text-[11px] text-slate-400">
              Snapshots are kept in the audit log. This action itself is recorded with your admin ID.
            </p>
          </div>
        }
      />
    </div>
  );
}
