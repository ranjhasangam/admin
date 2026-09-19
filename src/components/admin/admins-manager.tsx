"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, KeyRound, Lock, Pencil, Plus, RefreshCw, ShieldCheck,
  Trash2, UserPlus, Users, XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, PERMISSION_LABELS } from "@/lib/permissions";
import { generatePasswordHint, type AdminPayload } from "./admin-form-helpers";
import type { AdminMe, AdminUserRow, Role } from "@/lib/types";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DateTime } from "@/components/ui/datetime";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useAdminAction } from "@/components/hooks/use-admin-action";

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: String(body.error ?? `Request failed (${res.status})`) };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Network error — please retry." };
  }
}

export function AdminsManager({ admins, currentAdmin }: { admins: AdminUserRow[]; currentAdmin: AdminMe }) {
  const router = useRouter();
  const { push } = useToast();

  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [oneTimePassword, setOneTimePassword] = useState<{ email: string; password: string } | null>(null);

  const refresh = () => router.refresh();

  const toggleActive = async (a: AdminUserRow) => {
    setBusy(a.id);
    const res = await api(`/api/admins/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !a.is_active }),
    });
    setBusy(null);
    if (res.ok) {
      push({ type: "success", title: a.is_active ? `${a.email} deactivated` : `${a.email} activated` });
      refresh();
    } else push({ type: "error", title: "Action failed", message: res.error });
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    const res = await api(`/api/admins/${deleteTarget.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      push({ type: "success", title: `${deleteTarget.email} removed`, message: "Profile and auth user deleted." });
      setDeleteTarget(null);
      refresh();
    } else push({ type: "error", title: "Delete failed", message: res.error });
  };

  const doResetPassword = async (password: string | null) => {
    if (!resetTarget) return;
    setBusy(resetTarget.id);
    const res = await api<{ password?: string }>(`/api/admins/${resetTarget.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify(password ? { password } : {}),
    });
    setBusy(null);
    if (res.ok) {
      setResetTarget(null);
      setOneTimePassword({ email: resetTarget.email, password: res.data?.password ?? password ?? "" });
      push({ type: "success", title: `Password reset for ${resetTarget.email}` });
      refresh();
    } else push({ type: "error", title: "Reset failed", message: res.error });
  };

  return (
    <div className="space-y-4">
      <div className="card flex items-start gap-3 border-brand-200 bg-brand-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-xs leading-relaxed text-brand-950/80">
          <strong>Same Supabase project, no exposed secrets:</strong> new admins get a real Supabase
          Auth user (created server-side with the service-role key, which never reaches the
          browser) plus a role record in <code className="font-mono">admin_profiles</code>.
          Permissions are enforced by the database on every operation.
        </p>
      </div>

      <Card
        title={`Administrators (${admins.length})`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add admin
          </button>
        }
        bodyClassName="p-0"
      >
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Admin</th>
                <th className="th">Role</th>
                <th className="th hidden lg:table-cell">Extra permissions</th>
                <th className="th hidden md:table-cell">Status</th>
                <th className="th hidden xl:table-cell">Last login</th>
                <th className="th w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isSelf = a.id === currentAdmin.id;
                return (
                  <tr key={a.id} className="tr-hover border-b border-slate-100 last:border-0">
                    <td className="td">
                      <p className="flex items-center gap-2 font-medium text-slate-800">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                          {(a.full_name || a.email).slice(0, 2)}
                        </span>
                        {a.full_name || "—"}
                        {isSelf && <Badge color="blue">You</Badge>}
                      </p>
                      <p className="mt-0.5 pl-9 text-xs text-slate-400">{a.email}</p>
                    </td>
                    <td className="td"><RoleBadge role={a.role} /></td>
                    <td className="td hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {a.can_delete_requests && <Badge color="red">delete requests</Badge>}
                        {a.role === "support" && (
                          a.can_update_status ? <Badge color="green">update status</Badge> : <Badge color="slate">view only</Badge>
                        )}
                        {a.role === "admin" && !a.can_delete_requests && <Badge color="slate">no deletes</Badge>}
                      </div>
                    </td>
                    <td className="td hidden md:table-cell">
                      {a.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <XCircle className="h-3.5 w-3.5" /> Deactivated
                        </span>
                      )}
                    </td>
                    <td className="td hidden xl:table-cell">
                      <DateTime value={a.last_login_at} mode="relative" className="text-xs text-slate-500" />
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30"
                          title={isSelf ? "Use Settings for your own account" : "Edit role & permissions"}
                          aria-label="Edit admin"
                          disabled={isSelf || busy === a.id}
                          onClick={() => setEditTarget(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-30"
                          title={isSelf ? "Change your own password in Settings" : "Reset password"}
                          aria-label="Reset password"
                          disabled={isSelf || busy === a.id}
                          onClick={() => setResetTarget(a)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          className={`rounded-md p-1.5 disabled:opacity-30 ${a.is_active ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                          title={a.is_active ? "Deactivate admin" : "Activate admin"}
                          aria-label={a.is_active ? "Deactivate admin" : "Activate admin"}
                          disabled={isSelf || busy === a.id}
                          onClick={() => toggleActive(a)}
                        >
                          {busy === a.id ? <Spinner className="h-4 w-4" /> : a.is_active ? <Lock className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                        </button>
                        <button
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                          title={isSelf ? "You cannot delete your own account" : "Remove admin"}
                          aria-label="Remove admin"
                          disabled={isSelf || busy === a.id}
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={6} className="td py-12 text-center">
                    <Users className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                    <p className="text-sm text-slate-400">No administrators found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---- Add admin ---- */}
      <AddAdminModal
        open={addOpen}
        existingEmails={admins.map((a) => a.email)}
        onClose={() => setAddOpen(false)}
        onCreated={(email, password) => {
          setAddOpen(false);
          refresh();
          if (password) setOneTimePassword({ email, password });
        }}
      />

      {/* ---- Edit admin ---- */}
      <EditAdminModal
        target={editTarget}
        busy={busy === editTarget?.id}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); refresh(); }}
      />

      {/* ---- Reset password ---- */}
      <ResetPasswordModal
        target={resetTarget}
        busy={busy === resetTarget?.id}
        onClose={() => setResetTarget(null)}
        onReset={doResetPassword}
      />

      {/* ---- Delete admin ---- */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this administrator?"
        tone="danger"
        requireText={deleteTarget?.email ?? "DELETE"}
        confirmLabel={busy === deleteTarget?.id ? "Removing…" : "Remove admin"}
        pending={busy === deleteTarget?.id}
        onConfirm={doDelete}
        onClose={() => setDeleteTarget(null)}
        message={
          deleteTarget && (
            <div className="space-y-2">
              <p>
                <strong>{deleteTarget.full_name || deleteTarget.email}</strong> will lose all Admin
                Panel access immediately.
              </p>
              <p className="text-xs text-slate-500">
                This deletes the admin profile AND the Supabase Auth user ({deleteTarget.email}).
                Type their email address to confirm. The action is audit-logged.
              </p>
            </div>
          )
        }
      />

      {/* ---- One-time password reveal ---- */}
      <Modal
        open={oneTimePassword !== null}
        onClose={() => setOneTimePassword(null)}
        title="Credentials — shown only once"
        subtitle="Share them securely with the admin. They are never stored in the audit log."
        footer={
          <button className="btn btn-primary" onClick={() => setOneTimePassword(null)}>
            I have saved them
          </button>
        }
      >
        {oneTimePassword && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</p>
              <p className="flex items-center gap-1 text-sm font-medium text-slate-800">
                {oneTimePassword.email}
                <CopyButton value={oneTimePassword.email} />
              </p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Password</p>
              <p className="flex items-center gap-1 font-mono text-sm font-semibold text-brand-700 break-all">
                {oneTimePassword.password}
                <CopyButton value={oneTimePassword.password} />
              </p>
            </div>
            <p className="text-[11px] text-slate-400">
              After first login the admin should change their password under Settings → Security.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================ ADD ADMIN ============================ */

function AddAdminModal({
  open, existingEmails, onClose, onCreated,
}: {
  open: boolean;
  existingEmails: string[];
  onClose: () => void;
  onCreated: (email: string, oneTimePassword?: string) => void;
}) {
  const { push } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [canDelete, setCanDelete] = useState(false);
  const [canUpdateStatus, setCanUpdateStatus] = useState(true);
  const [autoPassword, setAutoPassword] = useState(true);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(""); setEmail(""); setRole("admin");
      setCanDelete(false); setCanUpdateStatus(true);
      setAutoPassword(true); setPassword("");
    }
  }, [open]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passwordOk = autoPassword || password.length >= 10;

  const submit = async () => {
    setPending(true);
    const res = await api<{ generated_password?: string }>(`/api/admins`, {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim() || null,
        role,
        can_delete_requests: canDelete,
        can_update_status: canUpdateStatus,
        ...(autoPassword ? {} : { password }),
      } satisfies AdminPayload),
    });
    setPending(false);
    if (res.ok) {
      push({ type: "success", title: `Admin created: ${email.trim()}` });
      onCreated(email.trim().toLowerCase(), res.data?.generated_password);
    } else {
      push({ type: "error", title: "Could not create admin", message: res.error });
    }
  };

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title="Add administrator"
      subtitle="Creates a Supabase Auth user in the same project + an admin profile with a role."
      wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={pending || !emailValid || !passwordOk || existingEmails.includes(email.trim().toLowerCase())}>
            {pending && <Spinner />}
            <Plus className="h-4 w-4" /> Create admin
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="na-email">Email *</label>
          <input id="na-email" type="email" className="input" placeholder="person@sddigitalhub.in"
            value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          {existingEmails.includes(email.trim().toLowerCase()) && (
            <p className="hint text-rose-600">This email already has an admin profile.</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="na-name">Full name</label>
          <input id="na-name" className="input" placeholder="Optional" value={fullName}
            onChange={(e) => setFullName(e.target.value)} maxLength={120} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="na-role">Role</label>
          <select id="na-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(["super_admin", "admin", "support"] as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <p className="hint">{ROLE_DESCRIPTIONS[role]}</p>
        </div>

        {role !== "super_admin" && (
          <div className="sm:col-span-2 space-y-2 rounded-lg border border-slate-200 p-3.5">
            <p className="text-xs font-semibold text-slate-600">Permission flags</p>
            {role === "admin" && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={canDelete}
                  onChange={(e) => setCanDelete(e.target.checked)} />
                {PERMISSION_LABELS.delete_requests}
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={canUpdateStatus}
                onChange={(e) => setCanUpdateStatus(e.target.checked)} />
              {PERMISSION_LABELS.update_status}
            </label>
          </div>
        )}

        <div className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-3.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={autoPassword}
              onChange={(e) => setAutoPassword(e.target.checked)} />
            Auto-generate a strong password (shown once)
          </label>
          {!autoPassword && (
            <div>
              <label className="label" htmlFor="na-pass">Password * (min 10 characters)</label>
              <div className="flex gap-2">
                <input id="na-pass" type="text" className="input font-mono" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="≥ 10 characters" />
                <button className="btn btn-secondary shrink-0" type="button"
                  onClick={() => setPassword(generatePasswordHint())} title="Generate a suggestion">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ============================ EDIT ADMIN ============================ */

function EditAdminModal({
  target, busy, onClose, onSaved,
}: {
  target: AdminUserRow | null;
  busy: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [canDelete, setCanDelete] = useState(false);
  const [canUpdateStatus, setCanUpdateStatus] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (target) {
      setFullName(target.full_name ?? "");
      setRole(target.role);
      setCanDelete(target.can_delete_requests);
      setCanUpdateStatus(target.can_update_status);
      setIsActive(target.is_active);
    }
  }, [target]);

  const submit = async () => {
    if (!target) return;
    const res = await api(`/api/admins/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        full_name: fullName.trim() || null,
        role, can_delete_requests: canDelete,
        can_update_status: canUpdateStatus, is_active: isActive,
      }),
    });
    if (res.ok) {
      push({ type: "success", title: `${target.email} updated` });
      onSaved();
    } else push({ type: "error", title: "Update failed", message: res.error });
  };

  return (
    <Modal
      open={target !== null}
      onClose={busy ? () => {} : onClose}
      title={`Edit ${target?.email ?? "admin"}`}
      subtitle="Role and permission changes apply immediately — the database enforces them."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy && <Spinner />} Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="ea-name">Full name</label>
          <input id="ea-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="ea-role">Role</label>
          <select id="ea-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(["super_admin", "admin", "support"] as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <p className="hint">{ROLE_DESCRIPTIONS[role]}</p>
        </div>
        {role !== "super_admin" && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3.5">
            {role === "admin" && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={canDelete} onChange={(e) => setCanDelete(e.target.checked)} />
                {PERMISSION_LABELS.delete_requests}
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={canUpdateStatus} onChange={(e) => setCanUpdateStatus(e.target.checked)} />
              {PERMISSION_LABELS.update_status}
            </label>
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3.5 py-2.5">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className="text-sm text-slate-700">
            Account is active
            <span className="block text-[11px] text-slate-400">Deactivating immediately blocks panel access and ends live sessions.</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

/* ========================= RESET PASSWORD ========================= */

function ResetPasswordModal({
  target, busy, onClose, onReset,
}: {
  target: AdminUserRow | null;
  busy: boolean;
  onClose: () => void;
  onReset: (password: string | null) => void;
}) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (target) { setMode("auto"); setPassword(""); }
  }, [target]);

  return (
    <Modal
      open={target !== null}
      onClose={busy ? () => {} : onClose}
      title={`Reset password — ${target?.email ?? ""}`}
      subtitle="The admin's live sessions are signed out. The new password is shown once and never logged."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={busy || (mode === "manual" && password.length < 10)}
            onClick={() => onReset(mode === "auto" ? null : password)}
          >
            {busy && <Spinner />}
            <KeyRound className="h-4 w-4" /> Reset password
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3.5 py-2.5">
          <input type="radio" name="reset-mode" className="accent-brand-600" checked={mode === "auto"} onChange={() => setMode("auto")} />
          <span className="text-sm text-slate-700">Auto-generate a strong password (recommended)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3.5 py-2.5">
          <input type="radio" name="reset-mode" className="accent-brand-600" checked={mode === "manual"} onChange={() => setMode("manual")} />
          <span className="text-sm text-slate-700">Set a specific password</span>
        </label>
        {mode === "manual" && (
          <input
            className="input font-mono"
            placeholder="min 10 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        )}
      </div>
    </Modal>
  );
}
