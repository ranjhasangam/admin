"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Menu, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminMe } from "@/lib/types";
import { RoleBadge } from "@/components/ui/badge";

const TITLES: [RegExp, string][] = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/requests\/service\/.+/, "Service Request"],
  [/^\/requests\/contact\/.+/, "Contact Request"],
  [/^\/requests\/callback\/.+/, "Callback Request"],
  [/^\/requests\/service/, "Service Requests"],
  [/^\/requests\/contact/, "Contact Requests"],
  [/^\/requests\/callback/, "Callback Requests"],
  [/^\/requests/, "All Requests"],
  [/^\/analytics/, "Analytics"],
  [/^\/sessions/, "Website Sessions"],
  [/^\/website\/business/, "Business Information"],
  [/^\/website\/contact/, "Contact Information"],
  [/^\/website\/social/, "Social Links"],
  [/^\/security\/blocked-ips/, "Blocked IPs"],
  [/^\/administration\/admins/, "Admin Users"],
  [/^\/administration\/audit/, "Audit Logs"],
  [/^\/settings/, "Settings"],
];

export function Topbar({
  admin,
  onMenu,
}: {
  admin: AdminMe;
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const title = useMemo(() => {
    for (const [re, t] of TITLES) if (re.test(pathname)) return t;
    return "Admin Panel";
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
      <button
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>

      <div className="ml-auto flex items-center gap-2">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.refresh()}
          title="Refresh data from Supabase"
          aria-label="Refresh data"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 sm:flex">
          <span className="max-w-40 truncate text-xs font-medium text-slate-600">
            {admin.full_name || admin.email}
          </span>
          <RoleBadge role={admin.role} />
        </div>
      </div>
    </header>
  );
}
