"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { updateOwnName } from "@/actions/profile";
import { useAdminAction } from "@/components/hooks/use-admin-action";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import type { AdminMe } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";

export function ProfileForm({ admin }: { admin: AdminMe }) {
  const [name, setName] = useState(admin.full_name ?? "");
  const saveAction = useAdminAction(updateOwnName);
  const dirty = name.trim() !== (admin.full_name ?? "") && name.trim().length > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="own-email">Email (login identity)</label>
        <input id="own-email" className="input" value={admin.email} disabled />
        <p className="hint">
          Managed by Supabase Auth in the shared project — ask another Super Admin to change it via
          Admin Users if ever needed.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="own-name">Display name</label>
        <div className="flex gap-2">
          <input
            id="own-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Your name"
          />
          <button
            className="btn btn-primary shrink-0"
            disabled={!dirty || saveAction.pending}
            onClick={() => saveAction.run(name)}
          >
            {saveAction.pending ? <Spinner /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChangePasswordForm() {
  const { push } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);

  const valid = password.length >= 10 && password === confirm;

  const submit = async () => {
    if (!valid || pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        push({
          type: "error",
          title: "Password change failed",
          message:
            error.message.toLowerCase().includes("session") || error.message.toLowerCase().includes("reauth")
              ? "For security, Supabase asked you to sign in again before changing the password."
              : "Could not update the password. Please retry or sign in again.",
        });
      } else {
        push({ type: "success", title: "Password changed", message: "Use it at your next sign-in." });
        setPassword("");
        setConfirm("");
      }
    } catch {
      push({ type: "error", title: "Password change failed", message: "Unexpected error — please retry." });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="pw-new">New password (min 10 characters)</label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="pw-new"
            type={show ? "text" : "password"}
            className="input pl-9 pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pw-confirm">Confirm new password</label>
        <input
          id="pw-confirm"
          type={show ? "text" : "password"}
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="••••••••••"
        />
        {confirm && password !== confirm && (
          <p className="hint text-rose-600">Passwords do not match.</p>
        )}
      </div>
      <button className="btn btn-primary" disabled={!valid || pending} onClick={submit}>
        {pending ? <Spinner /> : <KeyRound className="h-4 w-4" />} Update password
      </button>
      <p className="hint">
        Your password lives in Supabase Auth (same project as the main website). It is never stored
        or logged by this panel.
      </p>
    </div>
  );
}
