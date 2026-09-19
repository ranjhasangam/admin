import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <span className="rounded-2xl bg-slate-100 p-3.5 text-slate-400">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="mt-1 text-sm font-semibold text-slate-800">{title}</h3>
      {message && <p className="max-w-sm text-xs text-slate-500">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
