export interface LineDatum {
  label: string;
  [key: string]: string | number;
}

export interface LineSeries {
  key: string;
  name: string;
  color: string;
}

/** Dependency-free multi-series SVG line chart with area fill for the first series. */
export function MultiLineChart({
  data,
  series,
  height = 190,
}: {
  data: LineDatum[];
  series: LineSeries[];
  height?: number;
}) {
  const W = 620;
  const H = height;
  const padT = 10;
  const padB = 20;
  const n = data.length;
  if (n === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No data in range</p>;
  }

  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const labelStep = Math.max(1, Math.ceil(n / 8));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Trend chart">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={padT + (1 - f) * (H - padT - padB)}
            y2={padT + (1 - f) * (H - padT - padB)}
            stroke="#e2e8f0"
            strokeWidth={0.6}
            strokeDasharray={f === 1 ? undefined : "3 4"}
          />
        ))}
        {series.map((s, si) => {
          const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(Number(d[s.key]) || 0).toFixed(1)}`);
          return (
            <g key={s.key}>
              {si === 0 && (
                <path
                  d={`M ${pts.join(" L ")} L ${x(n - 1)},${H - padB} L ${x(0)},${H - padB} Z`}
                  fill={s.color}
                  opacity={0.08}
                />
              )}
              <polyline
                points={pts.join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={si === 0 ? 2 : 1.3}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={si === 0 ? 1 : 0.75}
              />
              {n <= 40 &&
                data.map((d, i) => (
                  <circle key={i} cx={x(i)} cy={y(Number(d[s.key]) || 0)} r={2} fill={s.color}>
                    <title>{`${d.label} · ${s.name}: ${Number(d[s.key]) || 0}`}</title>
                  </circle>
                ))}
            </g>
          );
        })}
        {data.map((d, i) =>
          i % labelStep === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={8.5} fill="#94a3b8">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}
