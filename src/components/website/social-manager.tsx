"use client";

import { useEffect, useState } from "react";
import {
  Eye, EyeOff, Facebook, Instagram, Link2, Linkedin, MessageCircle, Pencil,
  Plus, Share2, Trash2, Twitter, Youtube,
} from "lucide-react";
import { deleteSocialLink, upsertSocialLink } from "@/actions/social";
import { useAdminAction } from "@/components/hooks/use-admin-action";
import type { SocialLinkRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DateTime } from "@/components/ui/datetime";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";

const PRESETS = ["instagram", "facebook", "youtube", "linkedin", "x", "whatsapp", "google_maps", "website"];

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("instagram")) return <Instagram className="h-4 w-4" />;
  if (p.includes("facebook")) return <Facebook className="h-4 w-4" />;
  if (p.includes("youtube")) return <Youtube className="h-4 w-4" />;
  if (p.includes("linkedin")) return <Linkedin className="h-4 w-4" />;
  if (p.includes("x") || p.includes("twitter")) return <Twitter className="h-4 w-4" />;
  if (p.includes("whatsapp")) return <MessageCircle className="h-4 w-4" />;
  return <Link2 className="h-4 w-4" />;
}

export function SocialManager({ links, canManage }: { links: SocialLinkRow[]; canManage: boolean }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SocialLinkRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SocialLinkRow | null>(null);

  const saveAction = useAdminAction(upsertSocialLink, () => {
    setEditorOpen(false);
    setEditing(null);
  });
  const toggleAction = useAdminAction(upsertSocialLink);
  const deleteAction = useAdminAction(deleteSocialLink, () => setDeleteTarget(null));

  const openAdd = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (l: SocialLinkRow) => { setEditing(l); setEditorOpen(true); };

  return (
    <div className="space-y-4">
      <Card
        title={`Links (${links.length})`}
        subtitle={canManage ? "Visible links appear on the main website automatically." : "Read-only for your role."}
        actions={canManage ? (
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" /> Add link
          </button>
        ) : undefined}
        bodyClassName="p-0"
      >
        {links.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No social links yet"
            message="Add Instagram, Facebook, YouTube, LinkedIn, X, WhatsApp or any other public URL."
            action={canManage ? (
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add your first link
              </button>
            ) : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${l.is_visible ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-400"}`}>
                  {platformIcon(l.platform)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold capitalize text-slate-800">{l.platform}</span>
                    {l.label && <span className="text-xs text-slate-400">· {l.label}</span>}
                    {!l.is_visible && <Badge color="slate">Hidden</Badge>}
                  </p>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block max-w-full truncate text-xs text-brand-600 hover:underline"
                    title={l.url}
                  >
                    {l.url}
                  </a>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Order</p>
                  <p className="text-sm font-semibold text-slate-600 tabular-nums">{l.sort_order}</p>
                </div>
                <div className="hidden shrink-0 text-right md:block">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Updated</p>
                  <DateTime value={l.updated_at} mode="relative" className="text-xs text-slate-500" />
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className={`rounded-md p-1.5 hover:bg-slate-100 ${l.is_visible ? "text-emerald-600" : "text-slate-400"}`}
                      title={l.is_visible ? "Hide from website" : "Show on website"}
                      aria-label={l.is_visible ? "Hide link" : "Show link"}
                      disabled={toggleAction.pending}
                      onClick={() =>
                        toggleAction.run({
                          id: l.id, platform: l.platform, url: l.url, label: l.label,
                          is_visible: !l.is_visible, sort_order: l.sort_order,
                        })
                      }
                    >
                      {l.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                      title="Edit link"
                      aria-label="Edit link"
                      onClick={() => openEdit(l)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Delete link"
                      aria-label="Delete link"
                      onClick={() => setDeleteTarget(l)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage && (
        <SocialLinkEditor
          open={editorOpen}
          link={editing}
          pending={saveAction.pending}
          onClose={() => { setEditorOpen(false); setEditing(null); }}
          onSubmit={(payload) => saveAction.run(payload)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this social link?"
        tone="danger"
        confirmLabel={deleteAction.pending ? "Deleting…" : "Delete link"}
        pending={deleteAction.pending}
        onConfirm={() => deleteTarget && deleteAction.run(deleteTarget.id, deleteTarget.platform)}
        onClose={() => setDeleteTarget(null)}
        message={
          deleteTarget && (
            <p>
              <strong className="capitalize">{deleteTarget.platform}</strong> →{" "}
              <span className="break-all font-mono text-xs">{deleteTarget.url}</span> will be
              removed from the website. This is recorded in the audit log.
            </p>
          )
        }
      />
    </div>
  );
}

function SocialLinkEditor({
  open,
  link,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  link: SocialLinkRow | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    id?: string | null; platform: string; url: string; label?: string | null;
    is_visible?: boolean; sort_order?: number;
  }) => void;
}) {
  const [platform, setPlatform] = useState("");
  const [customPlatform, setCustomPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [visible, setVisible] = useState(true);
  const [order, setOrder] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (link) {
      const preset = PRESETS.includes(link.platform) ? link.platform : "custom";
      setPlatform(preset);
      setCustomPlatform(preset === "custom" ? link.platform : "");
      setUrl(link.url);
      setLabel(link.label ?? "");
      setVisible(link.is_visible);
      setOrder(link.sort_order);
    } else {
      setPlatform("instagram");
      setCustomPlatform("");
      setUrl("");
      setLabel("");
      setVisible(true);
      setOrder(0);
    }
  }, [open, link]);

  const finalPlatform = (platform === "custom" ? customPlatform : platform).trim().toLowerCase();
  const valid = finalPlatform !== "" && /^(https?:\/\/|wa\.me\/|mailto:|tel:)/i.test(url.trim());

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title={link ? "Edit social link" : "Add social link"}
      subtitle="Public URL only — never a password or private token."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={pending || !valid}
            onClick={() =>
              onSubmit({
                id: link?.id ?? null,
                platform: finalPlatform,
                url: url.trim(),
                label: label.trim() || null,
                is_visible: visible,
                sort_order: order,
              })
            }
          >
            {pending && <Spinner />}
            {link ? "Save changes" : "Add link"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="sl-platform">Platform</label>
          <select id="sl-platform" className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p} value={p} className="capitalize">{p.replace("_", " ")}</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {platform === "custom" && (
            <input
              className="input mt-2"
              placeholder="e.g. github, justdial, indiaMART"
              value={customPlatform}
              onChange={(e) => setCustomPlatform(e.target.value)}
              maxLength={40}
            />
          )}
        </div>
        <div>
          <label className="label" htmlFor="sl-url">URL *</label>
          <input
            id="sl-url"
            className="input font-mono text-xs"
            placeholder="https://instagram.com/yourprofile"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="hint">Must start with https://, http://, wa.me/, mailto: or tel:</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sl-label">Label (optional)</label>
            <input id="sl-label" className="input" placeholder="Follow us" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="sl-order">Sort order</label>
            <input
              id="sl-order" type="number" min={0} max={999} className="input"
              value={order} onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3.5 py-2.5">
          <input
            type="checkbox" className="h-4 w-4 accent-brand-600"
            checked={visible} onChange={(e) => setVisible(e.target.checked)}
          />
          <span className="text-sm text-slate-700">Visible on the main website</span>
        </label>
      </div>
    </Modal>
  );
}
