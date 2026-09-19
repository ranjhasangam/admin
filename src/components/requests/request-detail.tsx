import Link from "next/link";
import {
  ArrowLeft, Building2, Database, Mail, MessageCircle, Phone, Tag, User,
} from "lucide-react";
import type { AdminMe, RequestType } from "@/lib/types";
import { can } from "@/lib/permissions";
import { humanKey, telLink, waLink } from "@/lib/format";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DateTime } from "@/components/ui/datetime";
import { DetailActions } from "./detail-actions";

export interface RequestPayload {
  request_type: RequestType;
  request_id: string;
  table_name: string;
  data: Record<string, unknown>;
}

function pick(data: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return null;
}

export function RequestDetailView({
  payload,
  admin,
}: {
  payload: RequestPayload;
  admin: AdminMe;
}) {
  const d = payload.data;
  const name = pick(d, ["name", "full_name", "customer_name"]);
  const email = pick(d, ["email", "email_address"]);
  const phone = pick(d, ["phone", "phone_number", "mobile", "contact_number"]);
  const business = pick(d, ["business_name", "company_name", "company", "business"]);
  const service = pick(d, ["service_name", "service"]);
  const details = pick(d, ["details", "additional_details", "message", "notes", "description"]);
  const source = pick(d, ["source_section", "source", "section", "page_section"]);
  const price = pick(d, ["price_info", "price_information", "price", "pricing", "budget"]);
  const status = pick(d, ["status"]);
  const createdAt = pick(d, ["created_at", "submitted_at"]);
  const updatedAt = pick(d, ["updated_at", "last_updated_at"]);

  const canUpdate = can(admin, "update_status");
  const canDelete = can(admin, "delete_requests");

  const entries = Object.entries(d);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/requests/${payload.request_type}`}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {payload.request_type} requests
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">
              {name || "Request"} <span className="font-normal text-slate-400">·</span>{" "}
              <TypeBadge type={payload.request_type} />
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-400">
            {payload.request_id}
            <CopyButton value={payload.request_id} label="Copy request ID" />
          </p>
        </div>
        <DetailActions
          type={payload.request_type}
          id={payload.request_id}
          currentStatus={status}
          customerLabel={name || email || phone || payload.request_id}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT: request content */}
        <div className="space-y-4 lg:col-span-2">
          <Card title="Request information">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field icon={<Tag className="h-3.5 w-3.5" />} label="Request type">
                <TypeBadge type={payload.request_type} />
              </Field>
              <Field label="Service">{service ?? "—"}</Field>
              <Field label="Source section">{source ?? "—"}</Field>
              <Field label="Price information">{price ?? "—"}</Field>
            </dl>
            <div className="mt-5">
              <p className="label">Details / Message</p>
              {details ? (
                <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                  {details}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No details/message submitted with this request.</p>
              )}
            </div>
          </Card>

          <Card
            title="All stored fields"
            subtitle={`Complete record exactly as stored in ${payload.table_name} (read-only — customer submissions are never edited)`}
            bodyClassName="p-0"
          >
            <div className="table-scroll overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <tbody>
                  {entries.map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-100 last:border-0">
                      <td className="td w-56 bg-slate-50/60 font-mono text-xs text-slate-500 align-top">
                        {humanKey(k)}
                        <span className="block text-[10px] text-slate-300">{k}</span>
                      </td>
                      <td className="td align-top">
                        {renderValue(k, v)}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td className="td text-slate-400">No fields returned.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* RIGHT: customer + system */}
        <div className="space-y-4">
          <Card title="Customer">
            <div className="space-y-3.5">
              <Field icon={<User className="h-3.5 w-3.5" />} label="Name">{name ?? "—"}</Field>
              <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Business name">
                {business ?? "—"}
              </Field>
              <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                {email ? (
                  <a href={`mailto:${email}`} className="text-brand-600 hover:underline break-all">
                    {email}
                  </a>
                ) : "—"}
              </Field>
              <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                {phone ? (
                  <a href={telLink(phone) ?? "#"} className="text-brand-600 hover:underline">
                    {phone}
                  </a>
                ) : "—"}
              </Field>
            </div>

            {(phone || email) && (
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                {phone ? (
                  <a href={telLink(phone) ?? "#"} className="btn btn-secondary btn-sm">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                ) : (
                  <span className="btn btn-secondary btn-sm cursor-not-allowed opacity-40">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </span>
                )}
                {waLink(phone) ? (
                  <a
                    href={waLink(phone)!}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                ) : (
                  <span className="btn btn-sm cursor-not-allowed bg-emerald-50 text-emerald-600 opacity-40">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </span>
                )}
                {email ? (
                  <a href={`mailto:${email}`} className="btn btn-secondary btn-sm">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                ) : (
                  <span className="btn btn-secondary btn-sm cursor-not-allowed opacity-40">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </span>
                )}
              </div>
            )}
          </Card>

          <Card title="System" subtitle="Managed by the Admin Panel">
            <div className="space-y-3.5 text-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Request ID</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-slate-600 break-all">
                  {payload.request_id}
                  <CopyButton value={payload.request_id} />
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <Database className="mr-1 inline h-3 w-3" />
                  Source table
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-600">{payload.table_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Status</p>
                <div className="mt-1"><StatusBadge status={status} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Created at</p>
                  <p className="mt-0.5"><DateTime value={createdAt} className="text-xs text-slate-600" /></p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Updated at</p>
                  <p className="mt-0.5"><DateTime value={updatedAt} className="text-xs text-slate-600" /></p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function renderValue(key: string, v: unknown): React.ReactNode {
  if (v === null || v === undefined || String(v).trim() === "") {
    return <span className="text-slate-300">—</span>;
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    return <code className="block whitespace-pre-wrap break-all text-xs text-slate-500">{JSON.stringify(v, null, 2)}</code>;
  }
  const s = String(v);
  if (key.endsWith("_at") || key.endsWith("_at".toUpperCase())) {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return (
        <span className="text-xs">
          <DateTime value={s} /> <span className="text-slate-400">(<DateTime value={s} mode="relative" />)</span>
        </span>
      );
    }
  }
  if (key === "status") return <StatusBadge status={s} />;
  return <span className="whitespace-pre-wrap break-words text-sm text-slate-700">{s}</span>;
}
