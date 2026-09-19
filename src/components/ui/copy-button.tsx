"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "./toast";

export function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      push({ type: "success", title: "Copied to clipboard" });
    } catch {
      push({ type: "error", title: "Copy failed", message: "Your browser blocked clipboard access." });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 ${className}`}
      aria-label={label ?? "Copy"}
      title={label ?? "Copy to clipboard"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
