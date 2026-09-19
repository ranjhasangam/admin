"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, Building2, Contact, Inbox, LayoutDashboard, LogOut,
  Mail, PhoneCall, ScrollText, Settings, Share2, ShieldBan, Users, Wrench, X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { can } from "@/lib/permissions";
import type { AdminMe, Permission } from "@/lib/types";
import { RoleBadge } from "@/components/ui/badge";

interface NavLeaf {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
}

interface NavGroup {
  label: string;
  perm?: Permission;
  items: NavLeaf[];
}

const NAV: (NavLeaf | NavGroup)[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Requests",
    perm: "view_requests",
    items: [
      { href: "/requests", label: "All Requests", icon: Inbox },
      { href: "/requests/service", label: "Service Requests", icon: Wrench },
      { href: "/requests/contact", label: "Contact Requests", icon: Mail },
      { href: "/requests/callback", label: "Callback Requests", icon: PhoneCall },
    ],
  },
  {
    label: "Website",
    perm: "view_settings",
    items: [
      { href: "/website/business", label: "Business Information", icon: Building2 },
      { href: "/website/contact", label: "Contact Information", icon: Contact },
      { href: "/website/social", label: "Social Links", icon: Share2 },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, perm: "view_requests" },
      { href: "/sessions", label: "Website Sessions", icon: Activity, perm: "view_sessions" },
    ],
  },
  {
    label: "Security",
    perm: "view_blocked_ips",
    items: [{ href: "/security/blocked-ips", label: "Blocked IPs", icon: ShieldBan }],
  },
  {
    label: "Administration",
    items: [
      { href: "/administration/admins", label: "Admin Users", icon: Users, perm: "manage_admins" },
      { href: "/administration/audit", label: "Audit Logs", icon: ScrollText, perm: "view_audit" },
    ],
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/requests") return false; // exact match only for "All"
  return pathname.startsWith(`${href}/`);
}

export function Sidebar({
  admin,
  mobileOpen,
  setMobileOpen,
}: {
  admin: AdminMe;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [pendingLogout, startLogout] = useTransition();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const visibleNav = NAV.filter((entry) => {
    const group = entry as NavGroup;
    if (group.items) {
      if (group.perm && !can(admin, group.perm)) return false;
      return group.items.some((it) => !it.perm || can(admin, it.perm));
    }
    const leaf = entry as NavLeaf;
    return !leaf.perm || can(admin, leaf.perm);
  });

  const content = (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white shadow-lg shadow-brand-900/40">
          SD
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">SD Digital Hub</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">
            Admin Control Panel
          </p>
        </div>
        <button
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-sidebar-hover hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {visibleNav.map((entry, i) => {
          const group = entry as NavGroup;
          if (group.items) {
            const items = group.items.filter((it) => !it.perm || can(admin, it.perm));
            return (
              <div key={i}>
                <p className="nav-group-label">{group.label}</p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLeafLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            );
          }
          const leaf = entry as NavLeaf;
          return (
            <div key={i} className={i === 0 ? "" : "mt-5 border-t border-slate-800 pt-4"}>
              <NavLeafLink item={leaf} pathname={pathname} />
            </div>
          );
        })}
      </nav>

      {/* Footer: identity + logout */}
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 min-w-0">
          <p className="truncate text-xs font-semibold text-white">{admin.full_name || admin.email}</p>
          <p className="truncate text-[11px] text-slate-400">{admin.email}</p>
          <div className="mt-1.5">
            <RoleBadge role={admin.role} />
          </div>
        </div>
        {showLogoutConfirm ? (
          <div className="space-y-2 rounded-lg bg-sidebar-hover p-2.5">
            <p className="text-[11px] text-slate-300">Log out of the Admin Panel?</p>
            <div className="flex gap-2">
              <button
                className="btn btn-sm flex-1 bg-rose-600 text-white hover:bg-rose-700"
                disabled={pendingLogout}
                onClick={() => startLogout(() => logoutAction())}
              >
                {pendingLogout ? "Logging out…" : "Yes, log out"}
              </button>
              <button
                className="btn btn-sm flex-1 bg-slate-700 text-slate-200 hover:bg-slate-600"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={pendingLogout}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="nav-item w-full text-slate-300"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-in shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

function NavLeafLink({ item, pathname }: { item: NavLeaf; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`nav-item ${active ? "nav-item-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
