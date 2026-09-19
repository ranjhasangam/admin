import type { Metadata } from "next";
import {
  Activity, CheckCircle2, Clock, Inbox, Mail, PhoneCall, Wrench, XCircle,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { AnalyticsData } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { Card, StatCard } from "@/components/ui/card";
import { HBarList } from "@/components/charts/hbar-list";
import { MultiLineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DaysSelector } from "@/components/analytics/days-selector";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

const VALID_DAYS = [7, 30, 90, 365];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_requests")) return <NoAccess permission="view_requests" title="Analytics" />;

  const sp = await searchParams;
  const daysRaw = parseInt(Array.isArray(sp.days) ? sp.days[0] ?? "30" : sp.days ?? "30", 10);
  const days = VALID_DAYS.includes(daysRaw) ? daysRaw : 30;

  const { data, error } = await supabase.rpc("admin_analytics", { p_days: days });
  if (error || !data) {
    logRpcError("admin_analytics", error);
    return <RpcError message={rpcErrorText(error)} retryHref="/analytics" />;
  }
  const a = data as AnalyticsData;

  const daily = a.daily.map((d) => ({
    label: d.date.slice(5).replace("-", "/"),
    total: d.total,
    service: d.service,
    contact: d.contact,
    callback: d.callback,
  }));
  const sessionsDaily = a.sessions_daily.map((d) => ({
    label: d.date.slice(5).replace("-", "/"),
    value: d.count,
  }));

  return (
    <>
      <RealtimeRefresh intervalMs={120_000} />
      <PageHeader
        title="Analytics"
        subtitle={`Real figures aggregated in the database — last ${days} days for trends, all-time for totals. No invented data.`}
        actions={<DaysSelector current={days} />}
      />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Total Requests" value={a.totals.total} icon={<Inbox className="h-4 w-4" />} tone="brand" />
        <StatCard label="Service" value={a.totals.service} icon={<Wrench className="h-4 w-4" />} tone="indigo" />
        <StatCard label="Contact" value={a.totals.contact} icon={<Mail className="h-4 w-4" />} tone="sky" />
        <StatCard label="Callback" value={a.totals.callback} icon={<PhoneCall className="h-4 w-4" />} tone="violet" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Pending" value={a.status.pending} icon={<Clock className="h-4 w-4" />} tone="amber" href="/requests?status=pending" />
        <StatCard label="Completed" value={a.status.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" href="/requests?status=completed" />
        <StatCard label="Cancelled" value={a.status.cancelled} icon={<XCircle className="h-4 w-4" />} tone="rose" href="/requests?status=cancelled" />
        <StatCard label="Active Sessions" value={a.sessions.active} icon={<Activity className="h-4 w-4" />} tone="teal" href="/sessions?active=1"
          sub={`${a.sessions.today} today · ${a.sessions.last7} / 7d · ${a.sessions.last30} / 30d`} />
      </div>

      {/* Trends */}
      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title={`Requests per day — last ${days} days`}
          subtitle="All three request tables, grouped by day"
        >
          <MultiLineChart
            data={daily}
            series={[
              { key: "total", name: "Total", color: "#4f46e5" },
              { key: "service", name: "Service", color: "#0ea5e9" },
              { key: "contact", name: "Contact", color: "#14b8a6" },
              { key: "callback", name: "Callback", color: "#a855f7" },
            ]}
          />
        </Card>
        <Card
          className="xl:col-span-2"
          title={`Sessions per day — last ${days} days`}
          subtitle="From the existing website_sessions table"
        >
          {sessionsDaily.some((s) => s.value > 0) ? (
            <BarChart data={sessionsDaily} color="#14b8a6" height={190} />
          ) : (
            <p className="py-16 text-center text-xs text-slate-400">No sessions in this range.</p>
          )}
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Requests by service" subtitle="All-time, top 50">
          <HBarList items={a.by_service.map((s) => ({ name: s.name, count: s.count }))} />
          {a.by_service.length > 0 && (
            <div className="table-scroll mt-5 overflow-x-auto border-t border-slate-100 pt-4">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="th rounded-l-md">Service</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">Pending</th>
                    <th className="th text-right">Completed</th>
                    <th className="th rounded-r-md text-right">Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_service.slice(0, 12).map((s) => (
                    <tr key={s.name} className="border-b border-slate-100 last:border-0">
                      <td className="td max-w-48 truncate font-medium text-slate-700" title={s.name}>{s.name}</td>
                      <td className="td text-right font-semibold tabular-nums">{s.count}</td>
                      <td className="td text-right tabular-nums text-amber-600">{s.pending}</td>
                      <td className="td text-right tabular-nums text-emerald-600">{s.completed}</td>
                      <td className="td text-right tabular-nums text-rose-600">{s.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Requests by source section" subtitle="Where on the website requests originate">
          <HBarList
            items={a.by_source.map((s) => ({ name: s.name, count: s.count }))}
            barColor="bg-sky-500"
            emptyText="No source-section data recorded yet"
          />
        </Card>
      </div>
    </>
  );
}
