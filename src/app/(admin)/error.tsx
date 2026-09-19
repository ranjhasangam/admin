"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the real error for the operator; users see a friendly message.
    console.error("[admin-panel] route error:", error);
  }, [error]);

  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-slate-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-500">
        The panel hit an unexpected error while loading this section. Your data is safe — this is
        usually a temporary network or database hiccup.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[10px] text-slate-400">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="btn btn-primary">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
        <a href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
