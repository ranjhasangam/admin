"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ScrollText, Search } from "lucide-react";
import type { AuditRow, Paged } from "@/lib/types";
import { shortId } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { DateTime } from "@/components/ui/datetime";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";

const SECTIONS = [
  { value: "", label: "All sections" },
  { value: "auth", label: "Authentication" },
  { value: "requests", label: "Requests" },
  { value: "website_settings", label: "Website settings" },
  { value: "social_links", label: "Social links" },
  { value: "blocked_ips", label: "Blocked IPs" },
  { value: "admin_users", label: "Admin users" },
  { value: "settings", label: "Profile / settings" },
];

function actionColor(action: string): string {
  if (action.startsWith("auth.")) return "bg-slate-100 text-slate-600 ring-slate-300";
  if (action.startsWith("request.")) return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  if (action.startsWith("data.")) return "bg-teal-50 text-teal-700 ring-teal-200";
  if (action.startsWith("settings.") || action.startsWith("social.")) return "bg-sky-50 text-sky-700 ring-sky-200";
  if (action.startsWith("security.")) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (action.startsWith("admin.")) return "bg-brand-50 text-brand-700 ring-brand-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

export function AuditExplorer({ pageData }: { pageData: Paged<AuditRow> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [searchInput, setSearchInput] = useState(sp.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => { setSearchInput(sp.get("q") ?? ""); }, [sp]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const current = sp.get("q") ?? "";
    if (current === searchInput.trim()) return;
    const t = setTimeout(() => update({ q: searchInput.trim() || null }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function update(patch: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    p.delete("page");
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <Card bodyClassName="p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search action, admin email, record ID or details…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search audit logs"
            />
          </div>
          <select
            className="input w-auto min-w-44"
            value={sp.get("section") ?? ""}
            onChange={(e) => update({ section: e.target.value || null })}
            aria-label="Filter by section"
          >
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card bodyClassName="p-0">
        {pageData.rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit entries match"
            message="Actions like logins, status changes, deletes, blocks and settings updates are recorded automatically."
          />
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">When</th>
                  <th className="th">Admin</th>
                  <th className="th">Action</th>
                  <th className="th hidden md:table-cell">Section</th>
                  <th className="th hidden lg:table-cell">Record</th>
                  <th className="th hidden xl:table-cell">Details</th>
                </tr>
              </thead>
              <tbody>
                {pageData.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="td whitespace-nowrap">
                      <DateTime value={row.created_at} className="text-xs text-slate-600" />
                      <p className="text-[10px] text-slate-400">
                        <DateTime value={row.created_at} mode="relative" />
                      </p>
                    </td>
                    <td className="td">
                      <p className="max-w-44 truncate text-xs font-medium text-slate-700" title={row.admin_email ?? ""}>
                        {row.admin_name || row.admin_email || "system"}
                      </p>
                      {row.admin_name && row.admin_email && (
                        <p className="max-w-44 truncate text-[10px] text-slate-400">{row.admin_email}</p>
                      )}
                    </td>
                    <td className="td">
                      <span className={`badge font-mono text-[10px] ${actionColor(row.action)}`}>{row.action}</span>
                    </td>
                    <td className="td hidden md:table-cell text-xs text-slate-500">{row.section ?? "—"}</td>
                    <td className="td hidden lg:table-cell">
                      {row.record_id ? (
                        <span className="font-mono text-[11px] text-slate-400" title={row.record_id}>
                          {shortId(row.record_id, 16)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="td hidden xl:table-cell">
                      <DetailsCell details={row.details} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pageData.page} pages={pageData.pages} total={pageData.total} pageSize={pageData.page_size} />
      </Card>
    </div>
  );
}

function DetailsCell({ details }: { details: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(details ?? {});
  if (entries.length === 0) return <span className="text-xs text-slate-300">—</span>;

  // Compact one-line summary of the first few primitive fields.
  const summary = entries
    .filter(([, v]) => typeof v !== "object")
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");

  return (
    <div className="max-w-72">
      <button
        className="flex items-center gap-1 text-left text-[11px] text-slate-500 hover:text-brand-600"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="truncate">{summary || "view details"}</span>
      </button>
      {open && (
        <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg bg-slate-900 p-2.5 font-mono text-[10px] leading-relaxed text-emerald-300">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}
