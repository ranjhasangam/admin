import { Terminal } from "lucide-react";

/** Shown when Supabase environment variables are missing (no dummy data ever). */
export function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-200 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 font-black text-white">
            SD
          </span>
          <div>
            <h1 className="text-lg font-bold text-white">SD Digital Hub — Admin Panel</h1>
            <p className="text-xs text-slate-400">Setup required before first use</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <strong className="font-semibold">Supabase is not configured.</strong> This panel refuses
          to run with demo/dummy data by design. Connect it to your EXISTING Supabase project (the
          same one used by sddigitalhub.in) to continue.
        </div>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <Step n={1} />
            <div>
              <p className="font-semibold text-white">Copy the environment template</p>
              <Code>cp .env.example .env.local</Code>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <div>
              <p className="font-semibold text-white">Fill in your existing project values</p>
              <p className="mt-1 text-slate-400">
                Supabase Dashboard → Project Settings → API. Use the SAME project as the main
                website — never create a second one.
              </p>
              <Code>NEXT_PUBLIC_SUPABASE_URL=https://&lt;your-project&gt;.supabase.co{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=&lt;anon public key&gt;{"\n"}SUPABASE_SERVICE_ROLE_KEY=&lt;service_role key — server only&gt;</Code>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={3} />
            <div>
              <p className="font-semibold text-white">Run the SQL files in order</p>
              <p className="mt-1 text-slate-400">
                Your existing main-website SQL is already applied → then run{" "}
                <span className="font-mono text-brand-300">sql/00_inspect_existing_schema.sql</span>{" "}
                (read-only) and{" "}
                <span className="font-mono text-brand-300">sql/01_admin_migration.sql</span>.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={4} />
            <div>
              <p className="font-semibold text-white">Create the first Super Admin & restart</p>
              <p className="mt-1 text-slate-400">
                See README.md §“First Super Admin”. Then restart the dev server / redeploy.
              </p>
            </div>
          </li>
        </ol>

        <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
          <Terminal className="h-4 w-4" />
          Full instructions: README.md · DEPLOYMENT.md · INTEGRATION.md
        </div>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-xs font-bold text-brand-300">
      {n}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-emerald-300">
      {children}
    </pre>
  );
}
