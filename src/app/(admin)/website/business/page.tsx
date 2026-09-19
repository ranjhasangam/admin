import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guard";
import { can } from "@/lib/permissions";
import { logRpcError, rpcErrorText } from "@/lib/rpc-errors";
import type { SettingsMap } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { NoAccess } from "@/components/ui/no-access";
import { RpcError } from "@/components/ui/rpc-error";
import { SettingsForm, type SettingsField } from "@/components/website/settings-form";
import { PropagationNote } from "@/components/website/propagation-note";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Information" };

const FIELDS: SettingsField[] = [
  { key: "business_name", label: "Business name", placeholder: "SD Digital Hub", maxLength: 120 },
  { key: "business_description", label: "Business description", type: "textarea", placeholder: "Short public description used by the website", maxLength: 600, hint: "Only used if the main website reads this field." },
  { key: "address", label: "Address", type: "textarea", placeholder: "Street / area", maxLength: 300 },
  { key: "city", label: "City", placeholder: "Patna", maxLength: 80 },
  { key: "state", label: "State", placeholder: "Bihar", maxLength: 80 },
  { key: "pincode", label: "PIN code", placeholder: "800001", maxLength: 12 },
  { key: "country", label: "Country", placeholder: "India", maxLength: 80 },
];

export default async function BusinessInfoPage() {
  const { supabase, admin } = await requireAdmin();
  if (!can(admin, "view_settings")) return <NoAccess permission="view_settings" title="Business Information" />;

  const { data, error } = await supabase.rpc("admin_get_settings");
  if (error) {
    logRpcError("admin_get_settings", error);
    return <RpcError message={rpcErrorText(error)} retryHref="/website/business" />;
  }

  return (
    <>
      <PageHeader
        title="Business Information"
        subtitle="Managed centrally in Supabase — the single source of truth shared with the main website."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SettingsForm
            title="Business profile"
            description="These values are stored in website_settings and served to the main website via get_website_settings()."
            fields={FIELDS}
            initial={(data ?? {}) as SettingsMap}
            readOnly={!can(admin, "manage_settings")}
          />
        </div>
        <PropagationNote />
      </div>
    </>
  );
}
