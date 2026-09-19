"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, Info, Search, ShieldCheck, Trash2, Unlock } from "lucide-react";
import { blockIp, deleteBlockedIp, unblockIp } from "@/actions/security";
import { useAdminAction } from "@/components/hooks/use-admin-action";
import { maskHash } from "@/lib/format";
import type { BlockedIpRow, Paged } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DateTime } from "@/components/ui/datetime";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";

export function BlockedIpsManager({
  pageData,
  canManage,
}: {
  pageData: Paged<BlockedIpRow>;
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [searchInput, setSearchInput] = useState(sp.get("q") ?? "");
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<BlockedIpRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockedIpRow | null>(null);
  const first = useRef(true);

  const blockAction = useAdminAction(blockIp, () => setBlockModalOpen(false));
  const unblockAction = useAdminAction(unblockIp, () => setUnblockTarget(null));
  const deleteAction = useAdminAction(deleteBlockedIp, () => setDeleteTarget(null));

  useEffect(() => { setSearchInput(sp.get("q") ?? ""); }, [sp]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const current = sp.get("q") ?? "";
    if (current === searchInput.trim()) return;
    const t = setTimeout(() => update({ q: searchInput.trim() || null }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function update(patch: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    if (!("page" in patch)) p.delete("page");
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const activeOnly = (sp.get("active") ?? "1") === "1";

  return (
    <div className="space-y-4">
      {/* How it works */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card flex items-start gap-3 border-sky-200 bg-sky-50/60 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p className="text-xs leading-relaxed text-sky-900">
            <strong>How blocking works:</strong> when a visitor submits any request on the main
            website, a database trigger on the existing request tables compares the visitor&apos;s
            IP hash against this list and rejects the submission <em>before</em> insertion — no
            record is created in service/contact/callback tables. Unblocking restores normal
            submission under the existing 5-per-hour rate limit.
          </p>
        </div>
        <div className="card flex items-start gap-3 border-emerald-200 bg-emerald-50/60 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-emerald-900">
            <strong>Privacy &amp; compatibility:</strong> raw IP addresses are never stored — only
            SHA-256 hashes, produced by <code className="font-mono">admin_hash_ip()</code> in your
            database. If your main website hashes IPs differently, adjust that one function so the
            values match (see INTEGRATION.md).
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <Card bodyClassName="p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search hash, label, reason or blocked-by…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search blocked IPs"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {[
                { v: "1", label: "Active blocks" },
                { v: "", label: "All records" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => update({ active: o.v || null })}
                  className={`badge cursor-pointer transition ${
                    (sp.get("active") ?? "1") === o.v
                      ? "bg-brand-100 text-brand-800 ring-brand-300"
                      : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {canManage && (
              <button className="btn btn-danger" onClick={() => setBlockModalOpen(true)}>
                <Ban className="h-4 w-4" /> Block IP
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card bodyClassName="p-0">
        {pageData.rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={activeOnly ? "No active IP blocks" : "No blocked-IP records"}
            message="The existing rate limiting (5 requests/hour per IP hash) keeps protecting your forms automatically."
          />
        ) : (
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">IP hash</th>
                  <th className="th hidden md:table-cell">Label</th>
                  <th className="th hidden md:table-cell">Reason</th>
                  <th className="th">State</th>
                  <th className="th hidden sm:table-cell">Blocked by</th>
                  <th className="th hidden lg:table-cell">Created</th>
                  <th className="th hidden lg:table-cell">Expires</th>
                  {canManage && <th className="th w-28 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageData.rows.map((b) => {
                  const expired = b.expires_at ? new Date(b.expires_at).getTime() < Date.now() : false;
                  const active = b.is_active && !expired;
                  return (
                    <tr key={b.id} className="tr-hover border-b border-slate-100 last:border-0">
                      <td className="td">
                        <span className="flex items-center gap-1 font-mono text-xs text-slate-700">
                          {maskHash(b.ip_hash)}
                          <CopyButton value={b.ip_hash} label="Copy full hash" />
                        </span>
                      </td>
                      <td className="td hidden md:table-cell text-slate-600">{b.label || "—"}</td>
                      <td className="td hidden md:table-cell">
                        <span className="block max-w-52 truncate text-xs text-slate-500" title={b.reason ?? ""}>
                          {b.reason || "—"}
                        </span>
                      </td>
                      <td className="td">
                        {active ? <Badge color="red">Blocking</Badge>
                          : expired ? <Badge color="amber">Expired</Badge>
                          : <Badge color="slate">Unblocked</Badge>}
                      </td>
                      <td className="td hidden sm:table-cell text-xs text-slate-500">{b.blocked_by_email || "—"}</td>
                      <td className="td hidden lg:table-cell">
                        <DateTime value={b.created_at} className="text-xs text-slate-500" />
                      </td>
                      <td className="td hidden lg:table-cell">
                        {b.expires_at ? (
                          <DateTime value={b.expires_at} className="text-xs text-slate-500" />
                        ) : (
                          <span className="text-xs text-slate-400">Never</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="td">
                          <div className="flex items-center justify-end gap-1">
                            {b.is_active && (
                              <button
                                className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Unblock IP"
                                aria-label="Unblock IP"
                                disabled={unblockAction.pending}
                                onClick={() => setUnblockTarget(b)}
                              >
                                <Unlock className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Delete record"
                              aria-label="Delete record"
                              disabled={deleteAction.pending}
                              onClick={() => setDeleteTarget(b)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pageData.page} pages={pageData.pages} total={pageData.total} pageSize={pageData.page_size} />
      </Card>

      {/* Block modal */}
      <BlockIpForm
        open={blockModalOpen}
        pending={blockAction.pending}
        onClose={() => setBlockModalOpen(false)}
        onSubmit={(payload) => blockAction.run(payload)}
      />

      <ConfirmDialog
        open={unblockTarget !== null}
        title="Unblock this IP?"
        tone="primary"
        confirmLabel={unblockAction.pending ? "Unblocking…" : "Unblock"}
        pending={unblockAction.pending}
        onConfirm={() => unblockTarget && unblockAction.run(unblockTarget.id)}
        onClose={() => setUnblockTarget(null)}
        message={
          unblockTarget && (
            <div className="space-y-2">
              <p className="font-mono text-xs text-slate-500">{maskHash(unblockTarget.ip_hash)}</p>
              <p>
                The visitor will be able to submit requests again, under the existing rate limit
                (5 requests per hour per IP hash). The record is kept for history.
              </p>
            </div>
          )
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this blocked-IP record?"
        tone="danger"
        confirmLabel={deleteAction.pending ? "Deleting…" : "Delete record"}
        pending={deleteAction.pending}
        onConfirm={() => deleteTarget && deleteAction.run(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
        message={
          deleteTarget && (
            <p>
              Removes <span className="font-mono text-xs">{maskHash(deleteTarget.ip_hash)}</span>{" "}
              from the block list entirely{deleteTarget.is_active ? " — this also unblocks the IP immediately" : ""}.
              The action is written to the audit log.
            </p>
          )
        }
      />
    </div>
  );
}

function BlockIpForm({
  open,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { ip: string; reason: string | null; label: string | null; expires_at: string | null }) => void;
}) {
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");

  useEffect(() => {
    if (open) { setIp(""); setLabel(""); setReason(""); setExpires(""); }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title="Block an IP address"
      subtitle="Only the SHA-256 hash of the IP is stored — the raw address is discarded."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={pending || !ip.trim()}
            onClick={() =>
              onSubmit({
                ip: ip.trim(),
                reason: reason.trim() || null,
                label: label.trim() || null,
                expires_at: expires ? new Date(expires).toISOString() : null,
              })
            }
          >
            {pending ? <Spinner /> : <Ban className="h-4 w-4" />} Block IP
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="block-ip">IP address or 64-char hash *</label>
          <input
            id="block-ip"
            className="input font-mono"
            placeholder="203.0.113.45  or  9f8a…(hash copied from sessions)"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            autoFocus
          />
          <p className="hint">
            Tip: you can copy an IP hash directly from the Website Sessions page.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="block-label">Label (internal note)</label>
          <input
            id="block-label"
            className="input"
            placeholder="e.g. Spam wave on 19 Sep"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="block-reason">Reason</label>
          <textarea
            id="block-reason"
            className="input min-h-20"
            placeholder="Why is this IP blocked?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="block-expires">Auto-unblock at (optional)</label>
          <input
            id="block-expires"
            type="datetime-local"
            className="input"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
          <p className="hint">Leave empty to block indefinitely (until manually unblocked).</p>
        </div>
      </div>
    </Modal>
  );
}
