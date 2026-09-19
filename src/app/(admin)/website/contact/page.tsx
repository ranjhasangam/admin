import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import { phoneForLink, type SettingsMap } from "@/lib/types-and-format";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { SettingsForm, type SettingsField } from "@/components/website/settings-form";
import { PropagationNote } from "@/components/website/propagation-note";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact Information" };

const FIELDS: SettingsField[] = [
  {
    key: "phone",
    label: "Phone",
    type: "tel",
    placeholder: "+91 98765 43210",
    hint: "Displayed on the website and used for tel: links.",
    maxLength: 40,
  },
  {
    key: "email",
    label: "Email",
    type: "email",
    placeholder: "contact@sddigitalhub.in",
    hint: "Public business email used for mailto: links.",
    maxLength: 160,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    type: "tel",
    placeholder: "+91 98765 43210",
    hint: "Include the country code. The website builds wa.me links from this value.",
    maxLength: 40,
  },
];

export default async function ContactInfoPage() {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_settings")) return <NoAccess permission="view_settings" title="Contact Information" />;

  const { data, error } = await supabase.rpc("admin_get_settings");
  if (error) {
    logRpcError("admin_get_settings", error);
    return <RpcError message={rpcErrorText(error)} retryHref="/website/contact" />;
  }
  const settings = (data ?? {}) as SettingsMap;
  const waDigits = phoneForLink(settings.whatsapp ?? undefined);

  return (
    <>
      <PageHeader
        title="Contact Information"
        subtitle="Phone, email and WhatsApp — change once here, the main website updates automatically."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <SettingsForm
            title="Public contact channels"
            description="Stored in website_settings (same Supabase project) and served to the main website via get_website_settings()."
            fields={FIELDS}
            initial={settings}
            readOnly={!can(admin, "manage_settings")}
          />
          {waDigits && (
            <div className="card p-4 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Live WhatsApp link preview:</span>{" "}
              <a
                className="font-mono text-emerald-600 hover:underline"
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noreferrer"
              >
                https://wa.me/{waDigits}
              </a>
            </div>
          )}
        </div>
        <PropagationNote />
      </div>
    </>
  );
}
