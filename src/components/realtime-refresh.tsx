"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

const REALTIME_TABLES = ["service_requests", "contact_requests", "callback_requests"];

/**
 * Live updates (spec §26): subscribes to Supabase Realtime postgres_changes
 * on the EXISTING request tables and refreshes server components when a
 * customer submits something on the main website. A polling fallback keeps
 * the panel fresh even if realtime is unavailable.
 */
export function RealtimeRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const debouncedRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!disposed) router.refresh();
      }, 700);
    };
    refreshRef.current = debouncedRefresh;

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      if (isSupabaseConfigured) {
        const supabase = createClient();
        channel = supabase.channel("admin-panel-live");
        REALTIME_TABLES.forEach((table) => {
          channel = channel!.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            () => debouncedRefresh()
          );
        });
        channel.subscribe();
      }
    } catch (e) {
      console.warn("[admin-panel] realtime unavailable, using polling fallback:", e);
    }

    // Polling fallback (also covers session-table changes).
    const poll = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, intervalMs);

    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
      clearInterval(poll);
      if (channel) {
        try {
          createClient().removeChannel(channel);
        } catch { /* ignore */ }
      }
    };
  }, [router, intervalMs]);

  return null;
}
