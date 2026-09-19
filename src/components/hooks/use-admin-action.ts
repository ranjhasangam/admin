"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

/**
 * Wraps a server action with: pending state, success/error toasts and
 * automatic router.refresh() so server components re-fetch real data.
 */
export function useAdminAction<A extends unknown[]>(
  fn: (...args: A) => Promise<ActionResult>,
  onDone?: () => void
) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  const run = (...args: A) => {
    startTransition(async () => {
      try {
        const res = await fn(...args);
        if (res.ok) {
          push({ type: "success", title: res.message || "Done" });
          onDone?.();
          router.refresh();
        } else {
          push({ type: "error", title: "Action failed", message: res.error });
        }
      } catch (e) {
        console.error("[admin-panel] action error:", e);
        push({ type: "error", title: "Action failed", message: "Unexpected error. Please retry." });
      }
    });
  };

  return { run, pending };
}
