import type { Metadata } from "next";
import { isSupabaseConfigured, mainSiteUrl } from "@/lib/env";
import { NotConfigured } from "@/components/ui/not-configured";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSupabaseConfigured) return <NotConfigured />;

  const sp = await searchParams;
  const errorParam = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const nextParam = Array.isArray(sp.next) ? sp.next[0] : sp.next;

  const initialError =
    errorParam === "not_admin"
      ? "That account is signed in but has no active Admin Panel profile. Ask a Super Admin to grant access."
      : undefined;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* subtle backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-lg font-black text-white shadow-xl shadow-brand-900/50">
            SD
          </span>
          <h1 className="text-xl font-bold text-white">SD Digital Hub</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
            Admin Control Panel
          </p>
        </div>

        <div className="card p-6 shadow-2xl sm:p-8">
          <h2 className="text-base font-semibold text-slate-900">Administrator sign in</h2>
          <p className="mt-1 text-xs text-slate-500">
            Use your admin account credentials. Access is authorized, role-checked and logged.
          </p>

          {initialError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              {initialError}
            </div>
          )}

          <LoginForm next={nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard"} />
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Authorized administrators only · Every action is audit-logged ·{" "}
          <a href={mainSiteUrl} className="text-brand-300 hover:underline" target="_blank" rel="noreferrer">
            Main website
          </a>
        </p>
      </div>
    </div>
  );
}
