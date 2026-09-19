"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pages,
  total,
  pageSize,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const nums: (number | "…")[] = [];
  const push = (n: number | "…") => nums.push(n);
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) push(i);
  } else {
    push(1);
    if (page > 3) push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) push(i);
    if (page < pages - 2) push("…");
    push(pages);
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
      <p className="text-xs text-slate-500 tabular-nums">
        Showing <span className="font-semibold text-slate-700">{from}–{to}</span> of{" "}
        <span className="font-semibold text-slate-700">{total}</span> records
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="btn btn-secondary btn-sm px-2"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {nums.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1.5 text-xs text-slate-400">…</span>
            ) : (
              <button
                key={n}
                onClick={() => goTo(n)}
                className={`btn btn-sm min-w-8 px-2 tabular-nums ${
                  n === page ? "btn-primary" : "btn-secondary"
                }`}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </button>
            )
          )}
          <button
            className="btn btn-secondary btn-sm px-2"
            onClick={() => goTo(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
