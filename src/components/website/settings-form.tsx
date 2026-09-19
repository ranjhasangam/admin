"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, RotateCcw, Save } from "lucide-react";
import { saveSettings } from "@/actions/settings";
import { useAdminAction } from "@/components/hooks/use-admin-action";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export interface SettingsField {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  placeholder?: string;
  hint?: string;
  maxLength?: number;
}

/**
 * Limited website-settings form (spec §32–35): NOT a CMS. It writes plain
 * key/value settings into the same Supabase project; the main website reads
 * them via get_website_settings() and updates automatically.
 */
export function SettingsForm({
  title,
  description,
  fields,
  initial,
  readOnly,
}: {
  title: string;
  description: string;
  fields: SettingsField[];
  initial: Record<string, string | null>;
  readOnly: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const saveAction = useAdminAction(saveSettings);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of fields) next[f.key] = initial[f.key] ?? "";
    setValues(next);
  }, [initial, fields]);

  const dirty = fields.some((f) => (values[f.key] ?? "") !== (initial[f.key] ?? ""));

  const setField = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <Card title={title} subtitle={description}>
      {readOnly && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Your role can view website information but not modify it. Changes require the{" "}
            <strong>manage_settings</strong> permission (Super Admin).
          </span>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <label className="label" htmlFor={`setting-${f.key}`}>{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                id={`setting-${f.key}`}
                className="input min-h-24"
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                maxLength={f.maxLength}
                disabled={readOnly}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            ) : (
              <input
                id={`setting-${f.key}`}
                type={f.type ?? "text"}
                className="input"
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                maxLength={f.maxLength}
                disabled={readOnly}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            )}
            {f.hint && <p className="hint">{f.hint}</p>}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-5">
          <button
            className="btn btn-primary"
            disabled={!dirty || saveAction.pending}
            onClick={() => saveAction.run(Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ""])))}
          >
            {saveAction.pending ? <Spinner /> : dirty ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {dirty ? "Save changes" : "Saved"}
          </button>
          {dirty && (
            <button
              className="btn btn-secondary"
              disabled={saveAction.pending}
              onClick={() => {
                const next: Record<string, string> = {};
                for (const f of fields) next[f.key] = initial[f.key] ?? "";
                setValues(next);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Discard
            </button>
          )}
          <p className="ml-auto hidden text-[11px] text-slate-400 sm:block">
            Changes propagate to the main website automatically — no redeploy needed.
          </p>
        </div>
      )}
    </Card>
  );
}
