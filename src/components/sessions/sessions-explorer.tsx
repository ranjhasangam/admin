"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, MonitorSmartphone, Search } from "lucide-react";
import type { Paged, SessionRow } from "@/lib/types";
import { maskHash } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DateTime } from "@/components/ui/datetime";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";

export function SessionsExplorer({
  stats,
  pageData,
}: {
  stats: { total: number; active: number; today: number; last7: number; last30: number };
  pageData: Paged<SessionRow>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [searchInput, setSearchInput] = useState(sp.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    setSearchInput(sp.get("q") ?? "");
  }, [sp]);

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

  const activeFilter = sp.get("active");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <StatCard label="Active now" value={stats.active} icon={<Activity className="h-4 w-4" />} tone="teal" />
        <StatCard label="Today" value={stats.today} icon={<Activity className="h-4 w-4" />} tone="brand" />
        <StatCard label="Last 7 days" value={stats.last7} icon={<Activity className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Last 30 days" value={stats.last30} icon={<Activity className="h-4 w-4" />} tone="sky" />
        <StatCard label="Total tracked" value={stats.total} icon={<MonitorSmartphone className="h-4 w-4" />} tone="slate" />
      </div>

      <Card bodyClassName="p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search session ID, IP hash or user agent…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search sessions"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { v: "", label: "All" },
              { v: "1", label: "Active" },
              { v: "0", label: "Inactive" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => update({ active: o.v || null })}
                className={`badge cursor-pointer transition ${
                  (activeFilter ?? "") === o.v
                    ? "bg-brand-100 text-brand-800 ring-brand-300"
                    : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card bodyClassName="p-0">
        {pageData.rows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No sessions match"
            message="Sessions are created by the main website's existing touch_website_session flow. Adjust filters or check later."
          />
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">Session</th>
                  <th className="th">State</th>
                  <th className="th hidden sm:table-cell">First seen</th>
                  <th className="th">Last seen</th>
                  <th className="th hidden md:table-cell">Expires</th>
                  <th className="th hidden lg:table-cell">IP hash</th>
                  <th className="th hidden xl:table-cell">User agent</th>
                </tr>
              </thead>
              <tbody>
                {pageData.rows.map((s, i) => (
                  <tr key={`${s.session_id ?? i}`} className="tr-hover border-b border-slate-100 last:border-0">
                    <td className="td">
                      <span className="flex items-center gap-1 font-mono text-xs text-slate-600">
                        {s.session_id ? `${s.session_id.slice(0, 10)}…` : "—"}
                        {s.session_id && <CopyButton value={s.session_id} label="Copy session ID" />}
                      </span>
                    </td>
                    <td className="td">
                      {s.is_active ? <Badge color="green">Active</Badge> : <Badge color="slate">Inactive</Badge>}
                    </td>
                    <td className="td hidden sm:table-cell">
                      <DateTime value={s.created_at} className="text-xs text-slate-500" />
                    </td>
                    <td className="td">
                      <DateTime value={s.last_seen ?? s.created_at} mode="relative" className="text-xs text-slate-500" />
                    </td>
                    <td className="td hidden md:table-cell">
                      <DateTime value={s.expires_at} className="text-xs text-slate-500" />
                    </td>
                    <td className="td hidden lg:table-cell">
                      <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                        {maskHash(s.ip_hash)}
                        {s.ip_hash && <CopyButton value={s.ip_hash} label="Copy full IP hash (can be used to block)" />}
                      </span>
                    </td>
                    <td className="td hidden xl:table-cell">
                      <span className="block max-w-64 truncate text-[11px] text-slate-400" title={s.user_agent ?? ""}>
                        {s.user_agent || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={pageData.page}
          pages={pageData.pages}
          total={pageData.total}
          pageSize={pageData.page_size}
        />
      </Card>
    </div>
  );
}
