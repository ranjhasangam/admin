import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

/**
 * Friendly, non-technical error card (spec §43 — never show raw DB errors).
 * Retry simply reloads the route, re-running the server-side fetch.
 */
export function RpcError({
  message,
  retryHref,
  backHref,
  backLabel,
}: {
  message: string;
  retryHref?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-slate-900">Could not load this data</h2>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <div className="mt-6 flex items-center justify-center gap-2">
        {retryHref && (
          <a href={retryHref} className="btn btn-primary">
            <RefreshCw className="h-4 w-4" /> Retry
          </a>
        )}
        {backHref && (
          <a href={backHref} className="btn btn-secondary">
            <ArrowLeft className="h-4 w-4" /> {backLabel ?? "Go back"}
          </a>
        )}
      </div>
    </div>
  );
}
