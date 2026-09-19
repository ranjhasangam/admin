"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [7, 30, 90, 365];

export function DaysSelector({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (days: number) => {
    const p = new URLSearchParams(sp.toString());
    p.set("days", String(days));
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {OPTIONS.map((d) => (
        <button
          key={d}
          onClick={() => set(d)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            d === current
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          {d === 365 ? "1y" : `${d}d`}
        </button>
      ))}
    </div>
  );
}
