import { Radio, ExternalLink } from "lucide-react";
import { mainSiteUrl } from "@/lib/env";

export function PropagationNote() {
  return (
    <div className="space-y-4">
      <div className="card border-brand-200 bg-brand-50/50 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-900">
          <Radio className="h-4 w-4" /> How updates reach the website
        </h3>
        <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-brand-950/80">
          <li className="flex gap-2">
            <span className="font-bold text-brand-600">1.</span>
            You save a value here → it is written to <code className="font-mono">website_settings</code> in
            your existing Supabase project (audited with your admin ID).
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-600">2.</span>
            The main website calls the public RPC{" "}
            <code className="font-mono">get_website_settings()</code> when rendering.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-600">3.</span>
            It displays the new phone / email / WhatsApp / address / social links —{" "}
            <strong>no code edits, no redeploy</strong>.
          </li>
        </ol>
        <p className="mt-3 border-t border-brand-200/60 pt-3 text-[11px] text-brand-900/70">
          One-time wiring on the main website is required (a small snippet — see{" "}
          <span className="font-mono">INTEGRATION.md</span>). After that, everything is automatic.
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900">Guardrails</h3>
        <ul className="mt-2.5 space-y-2 text-xs text-slate-500">
          <li>• This is a limited settings system — not a CMS or page builder.</li>
          <li>• Social-media passwords are never requested or stored — URLs only.</li>
          <li>• Every change is recorded in the audit log with old → new values.</li>
          <li>• The main website&apos;s SEO system is untouched by this panel.</li>
        </ul>
        <a
          href={mainSiteUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary btn-sm mt-4"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open main website
        </a>
      </div>
    </div>
  );
}
