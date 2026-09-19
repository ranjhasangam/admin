"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Trash2, XCircle } from "lucide-react";
import { deleteRequest, updateRequestStatus } from "@/actions/requests";
import { useAdminAction } from "@/components/hooks/use-admin-action";
import type { RequestType } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

/**
 * Status + delete actions on the detail page (spec §15/§16/§17).
 * Status changes write straight to the EXISTING Supabase record.
 * There is deliberately NO form to edit customer-submitted data.
 */
export function DetailActions({
  type,
  id,
  currentStatus,
  customerLabel,
  canUpdate,
  canDelete,
}: {
  type: RequestType;
  id: string;
  currentStatus: string | null;
  customerLabel: string;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const statusAction = useAdminAction(updateRequestStatus);
  const deleteAction = useAdminAction(deleteRequest, () => {
    setDeleteOpen(false);
    router.push(`/requests/${type}`);
  });

  if (!canUpdate && !canDelete) return null;

  const statuses: {
    value: "pending" | "completed" | "cancelled";
    label: string;
    icon: React.ReactNode;
    activeCls: string;
  }[] = [
    { value: "pending", label: "Pending", icon: <Clock className="h-3.5 w-3.5" />, activeCls: "bg-amber-500 text-white hover:bg-amber-600" },
    { value: "completed", label: "Completed", icon: <CheckCircle2 className="h-3.5 w-3.5" />, activeCls: "bg-emerald-600 text-white hover:bg-emerald-700" },
    { value: "cancelled", label: "Cancelled", icon: <XCircle className="h-3.5 w-3.5" />, activeCls: "bg-rose-600 text-white hover:bg-rose-700" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate && (
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {statuses.map((s) => {
            const isCurrent = (currentStatus ?? "").toLowerCase() === s.value;
            return (
              <button
                key={s.value}
                className={`btn btn-sm ${isCurrent ? s.activeCls : "btn-ghost"}`}
                disabled={isCurrent || statusAction.pending}
                onClick={() => statusAction.run(type, id, s.value)}
                title={isCurrent ? `Currently ${s.label}` : `Mark ${s.label}`}
              >
                {statusAction.pending ? <Spinner className="h-3 w-3" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {canDelete && (
        <button className="btn btn-danger-soft" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this request permanently?"
        tone="danger"
        confirmLabel={deleteAction.pending ? "Deleting…" : "Delete permanently"}
        pending={deleteAction.pending}
        onConfirm={() => deleteAction.run(type, id)}
        onClose={() => setDeleteOpen(false)}
        message={
          <div className="space-y-2">
            <p>
              You are deleting the <strong>{type}</strong> request of{" "}
              <strong>{customerLabel}</strong>.
            </p>
            <p className="font-mono text-[11px] text-slate-400 break-all">{id}</p>
            <p className="text-[11px] text-slate-400">
              The record is removed from the existing Supabase table and a snapshot is stored in the
              audit log. This cannot be undone from the panel.
            </p>
          </div>
        }
      />
    </div>
  );
}
