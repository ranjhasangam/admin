import type { Metadata } from "next";
import {
  Activity, Ban, CheckCircle2, Clock, Inbox, Mail, PhoneCall, ShieldAlert,
  Users, Wrench, XCircle,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth-guard";
import { rpcErrorText, logRpcError } from "@/lib/rpc-errors";
import { can } from "@/lib/permissions";
import type { DashboardData } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { RpcError } from "@/components/ui/rpc-error";
import { Card, StatCard } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DateTime } from "@/components/ui/datetime";
import { BarChart } from "@/components/charts/bar-chart";
import { HBarList } from "@/components/charts/hbar-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { shortId } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, admin } = await requireAdmin();

  const { data, error } = await supabase.rpc("admin_dashboard_data");
  if (error || !data) {
    logRpcError("admin_dashboard_data", error);
    return (
      <RpcError
        message={rpcErrorText(error)}
        retryHref="/dashboard"
      />
    );
  }
  const d = data as DashboardData;

  const trend = d.trend_14d.map((t) => ({
    label: t.date.slice(5).replace("-", "/"),
    value: t.count,
  }));

  return (
    <>
      <RealtimeRefresh />
      <PageHeader
        title={`Welcome back, ${admin.full_name?.split(" ")[0] || admin.email.split("@")[0]}`}
        subtitle="Live figures from the production Supabase database — the same records the main website writes to."
      />

      {/* ---- Summary cards (spec §9) ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
        <StatCard label="Total Requests" value={d.requests.total} icon={<Inbox className="h-4 w-4" />} tone="brand" href="/requests"
          sub={`${d.requests.today} today · ${d.requests.last7} in 7 days`} />
        <StatCard label="Service" value={d.requests.service} icon={<Wrench className="h-4 w-4" />} tone="indigo" href="/requests/service" />
        <StatCard label="Contact" value={d.requests.contact} icon={<Mail className="h-4 w-4" />} tone="sky" href="/requests/contact" />
        <StatCard label="Callback" value={d.requests.callback} icon={<PhoneCall className="h-4 w-4" />} tone="violet" href="/requests/callback" />
        <StatCard label="Pending" value={d.requests.pending} icon={<Clock className="h-4 w-4" />} tone="amber" href="/requests?status=pending" />
        <StatCard label="Completed" value={d.requests.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" href="/requests?status=completed" />
        <StatCard label="Cancelled" value={d.requests.cancelled} icon={<XCircle className="h-4 w-4" />} tone="rose" href="/requests?status=cancelled" />
        <StatCard label="Active Sessions" value={d.sessions.active} icon={<Activity className="h-4 w-4" />} tone="teal" href="/sessions?active=1"
          sub={`${d.sessions.today} today · ${d.sessions.last30} in 30 days`} />
        <StatCard label="Blocked IPs" value={d.blocked_ips.active} icon={<Ban className="h-4 w-4" />} tone="slate"
          href={can(admin, "view_blocked_ips") ? "/security/blocked-ips" : undefined}
          sub={`${d.blocked_ips.total} total records`} />
        <StatCard label="Admin Users" value={d.admins.active} icon={<Users className="h-4 w-4" />} tone="brand"
          href={can(admin, "manage_admins") ? "/administration/admins" : undefined}
          sub={`${d.admins.total} registered`} />
      </div>

      {/* ---- Trend + recent requests ---- */}
      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        <Card
          className="xl:col-span-2"
          title="Requests — last 14 days"
          subtitle="Daily submissions across all three request tables"
        >
          {trend.some((t) => t.value > 0) ? (
            <BarChart data={trend} />
          ) : (
            <EmptyState icon={Inbox} title="No requests in the last 14 days"
              message="Submissions from the main website will appear here automatically." />
          )}
        </Card>

        <Card
          className="xl:col-span-3"
          title="Recent requests"
          subtitle="Newest first, straight from Supabase"
          bodyClassName="p-0"
          actions={<a href="/requests" className="btn btn-secondary btn-sm">View all</a>}
        >
          {d.recent_requests.length === 0 ? (
            <EmptyState icon={Inbox} title="No requests yet"
              message="When a customer submits any form on the main website, it appears here instantly." />
          ) : (
            <div className="table-scroll overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">Request</th>
                    <th className="th">Customer</th>
                    <th className="th hidden md:table-cell">Service</th>
                    <th className="th">Status</th>
                    <th className="th hidden sm:table-cell">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent_requests.map((r) => (
                    <tr key={`${r.request_type}-${r.request_id}`} className="tr-hover border-b border-slate-100 last:border-0">
                      <td className="td">
                        <a href={`/requests/${r.request_type}/${r.request_id}`} className="group flex items-center gap-2">
                          <TypeBadge type={r.request_type} />
                          <span className="font-mono text-xs text-slate-400 group-hover:text-brand-600">
                            {shortId(r.request_id, 6)}
                          </span>
                        </a>
                      </td>
                      <td className="td">
                        <p className="font-medium text-slate-800">{r.name || "—"}</p>
                        <p className="text-xs text-slate-400">{r.phone || r.email || ""}</p>
                      </td>
                      <td className="td hidden md:table-cell text-slate-500">{r.service_name || r.business_name || "—"}</td>
                      <td className="td"><StatusBadge status={r.status} /></td>
                      <td className="td hidden sm:table-cell">
                        <DateTime value={r.created_at} mode="relative" className="text-xs text-slate-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ---- Breakdown + security + activity ---- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Top services" subtitle="Requests by service name">
          <HBarList
            items={d.by_service.map((s) => ({ name: s.service, count: s.count }))}
            emptyText="No service requests recorded yet"
          />
        </Card>

        {can(admin, "view_blocked_ips") && (
          <Card
            title="Security"
            subtitle="Currently blocked IPs"
            actions={<a href="/security/blocked-ips" className="btn btn-secondary btn-sm">Manage</a>}
          >
            {d.recent_blocks.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                No active IP blocks. Request rate limiting (5/hour per IP hash) remains enforced by
                your existing database logic.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {d.recent_blocks.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-slate-700">{b.ip_hash_prefix}…</p>
                      <p className="truncate text-[11px] text-slate-500">{b.label || b.reason || "No reason given"}</p>
                    </div>
                    <DateTime value={b.created_at} mode="relative" className="shrink-0 text-[10px] text-slate-400" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {can(admin, "view_audit") && (
          <Card
            title="Recent admin activity"
            subtitle="From the audit log"
            actions={<a href="/administration/audit" className="btn btn-secondary btn-sm">View all</a>}
          >
            {d.recent_audit.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No admin actions recorded yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {d.recent_audit.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">
                        <span className="font-mono text-[11px] text-brand-600">{a.action}</span>
                        {a.record_id ? <span className="text-slate-400"> · {shortId(a.record_id, 14)}</span> : null}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{a.admin_email || "system"}</p>
                    </div>
                    <DateTime value={a.created_at} mode="relative" className="shrink-0 text-[10px] text-slate-400" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
