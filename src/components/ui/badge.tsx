import type { Role } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "").toLowerCase();
  return (
    <span className={`badge ${STATUS_STYLES[key] ?? "bg-slate-50 text-slate-600 ring-slate-500/20"}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          key === "pending" ? "bg-amber-500" : key === "completed" ? "bg-emerald-500" : key === "cancelled" ? "bg-rose-500" : "bg-slate-400"
        }`}
      />
      {STATUS_LABELS[key] ?? status ?? "—"}
    </span>
  );
}

const TYPE_STYLES: Record<string, string> = {
  service: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  contact: "bg-sky-50 text-sky-700 ring-sky-600/20",
  callback: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function TypeBadge({ type }: { type: string | null | undefined }) {
  const key = (type ?? "").toLowerCase();
  return (
    <span className={`badge ${TYPE_STYLES[key] ?? "bg-slate-50 text-slate-600 ring-slate-500/20"}`}>
      {key ? key.charAt(0).toUpperCase() + key.slice(1) : "—"}
    </span>
  );
}

const ROLE_STYLES: Record<Role, string> = {
  super_admin: "bg-brand-50 text-brand-700 ring-brand-600/20",
  admin: "bg-slate-100 text-slate-700 ring-slate-500/20",
  support: "bg-teal-50 text-teal-700 ring-teal-600/20",
};

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  support: "Support",
};

export function RoleBadge({ role }: { role: Role | string }) {
  const key = role as Role;
  return (
    <span className={`badge ${ROLE_STYLES[key] ?? "bg-slate-50 text-slate-600 ring-slate-500/20"}`}>
      {ROLE_LABELS[key] ?? role}
    </span>
  );
}

export function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: "slate" | "green" | "red" | "amber" | "blue";
}) {
  const map: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  };
  return <span className={`badge ${map[color]}`}>{children}</span>;
}
