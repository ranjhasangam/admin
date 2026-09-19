import type { Metadata } from "next";
import { Database, KeyRound, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth-guard";
import { hasServiceRole, mainSiteUrl, maskedProjectRef } from "@/lib/env";
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DateTime } from "@/components/ui/datetime";
import { ProfileForm, ChangePasswordForm } from "@/components/settings/profile-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { admin } = await requireAdmin();

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your own account, security and panel information."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card title="Profile" subtitle="How your identity appears in the panel and audit log">
            <ProfileForm admin={admin} />
          </Card>

          <Card title="Security" subtitle="Change your own Supabase Auth password">
            <ChangePasswordForm />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Your access">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{admin.email}</p>
                  <p className="text-xs text-slate-400">
                    Last login: <DateTime value={admin.last_login_at} mode="relative" />
                  </p>
                </div>
                <RoleBadge role={admin.role} />
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                <strong className="text-slate-700">{ROLE_LABELS[admin.role]}:</strong>{" "}
                {ROLE_DESCRIPTIONS[admin.role]}
              </p>
              <div>
                <p className="label flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Your active permissions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {admin.permissions.length === 0 && <Badge color="slate">none</Badge>}
                  {admin.permissions.map((p) => (
                    <Badge key={p} color="green">{PERMISSION_LABELS[p]}</Badge>
                  ))}
                </div>
                <p className="hint">
                  Permissions are enforced by the database on every operation — not by hiding
                  buttons alone.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Panel & connection" subtitle="Configuration status of this deployment">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-600">
                  <Database className="h-4 w-4 text-slate-400" /> Supabase project
                </span>
                <span className="font-mono text-xs text-slate-500">{maskedProjectRef()}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-600">
                  <KeyRound className="h-4 w-4 text-slate-400" /> Server admin API (service role)
                </span>
                {hasServiceRole ? <Badge color="green">configured</Badge> : <Badge color="amber">missing — admin management disabled</Badge>}
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Main website</span>
                <a href={mainSiteUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                  {mainSiteUrl.replace(/^https?:\/\//, "")}
                </a>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Panel version</span>
                <span className="font-mono text-xs text-slate-500">1.0.0</span>
              </li>
            </ul>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-[11px] leading-relaxed text-slate-500">
              One Supabase project · one source of truth. This panel never copies request data —
              it reads and manages the existing tables directly. Secrets (service-role key, DB
              password) exist only in server environment variables and are never sent to the
              browser.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
