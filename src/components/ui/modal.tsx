"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Spinner } from "./spinner";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog. For destructive actions pass requireText="DELETE"
 * to force a typed confirmation (spec §17, §25).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  requireText,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  requireText?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const needsTyped = Boolean(requireText);
  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title={title}
      footer={
        <TypedConfirmFooter
          tone={tone}
          confirmLabel={confirmLabel}
          requireText={requireText}
          pending={pending}
          onConfirm={onConfirm}
          onClose={onClose}
          resetKey={open ? "open" : "closed"}
        />
      }
    >
      <div className="text-sm text-slate-600 space-y-2">{message}</div>
      {needsTyped && (
        <p className="mt-3 text-xs text-slate-500">
          Type <span className="font-mono font-bold text-rose-600">{requireText}</span> below to
          enable the button.
        </p>
      )}
    </Modal>
  );
}

function TypedConfirmFooter({
  tone,
  confirmLabel,
  requireText,
  pending,
  onConfirm,
  onClose,
  resetKey,
}: {
  tone: "danger" | "primary";
  confirmLabel: string;
  requireText?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  resetKey: string;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => setTyped(""), [resetKey]);
  const blocked = requireText ? typed !== requireText : false;

  return (
    <div className="w-full space-y-3">
      {requireText && (
        <input
          className="input font-mono"
          placeholder={requireText}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
        />
      )}
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button
          className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={pending || blocked}
        >
          {pending && <Spinner />}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
