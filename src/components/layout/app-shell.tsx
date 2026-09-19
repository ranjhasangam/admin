"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { AdminMe } from "@/lib/types";

export function AppShell({ admin, children }: { admin: AdminMe; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar admin={admin} mobileOpen={mobileNavOpen} setMobileOpen={setMobileNavOpen} />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar admin={admin} onMenu={() => setMobileNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 md:p-6">{children}</main>
        <footer className="border-t border-slate-200 px-6 py-3 text-center text-[11px] text-slate-400">
          SD Digital Hub — Admin Control Panel · One Supabase project · All data is live from the
          production database
        </footer>
      </div>
    </div>
  );
}
