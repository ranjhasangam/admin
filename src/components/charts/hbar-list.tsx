export function HBarList({
  items,
  emptyText = "No data yet",
  barColor = "bg-brand-500",
}: {
  items: { name: string; count: number }[];
  emptyText?: string;
  barColor?: string;
}) {
  if (!items.length) {
    return <p className="py-6 text-center text-xs text-slate-400">{emptyText}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.name} className="flex items-center gap-3">
          <div
            className="w-36 shrink-0 truncate text-xs text-slate-600 sm:w-44"
            title={i.name}
          >
            {i.name}
          </div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.max(3, (i.count / max) * 100)}%` }}
            />
          </div>
          <div className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-slate-700">
            {i.count}
          </div>
        </div>
      ))}
    </div>
  );
}
