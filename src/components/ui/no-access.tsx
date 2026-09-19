import { ShieldAlert } from "lucide-react";
import { PERMISSION_LABELS } from "@/lib/permissions";
import type { Permission } from "@/lib/types";

export function NoAccess({
  permission,
  title,
}: {
  permission: Permission;
  title?: string;
}) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-slate-900">
        Access restricted{title ? ` — ${title}` : ""}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Your role does not include <strong>“{PERMISSION_LABELS[permission]}”</strong>. This rule is
        enforced by the database, not just the interface. Ask a Super Admin if you need access.
      </p>
      <a href="/dashboard" className="btn btn-secondary mt-6">
        Back to Dashboard
      </a>
    </div>
  );
}
