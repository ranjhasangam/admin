interface Datum {
  label: string;
  value: number;
}

/** Dependency-free SVG bar chart (renders on the server, scales responsively). */
export function BarChart({
  data,
  height = 160,
  color = "#6366f1",
  showLabels = true,
}: {
  data: Datum[];
  height?: number;
  color?: string;
  showLabels?: boolean;
}) {
  const W = 620;
  const H = height;
  const padT = 10;
  const padB = showLabels ? 20 : 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const bw = W / n;
  const labelStep = Math.ceil(n / 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bar chart">
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
      {data.map((d, i) => {
        const h = (d.value / max) * (H - padT - padB);
        const x = i * bw;
        const y = H - padB - h;
        return (
          <g key={i}>
            <rect
              x={x + bw * 0.18}
              y={y}
              width={bw * 0.64}
              height={Math.max(h, d.value > 0 ? 2.5 : 1)}
              rx={2.5}
              fill={color}
              opacity={d.value > 0 ? 0.9 : 0.12}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            {showLabels && i % labelStep === 0 && (
              <text
                x={x + bw / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize={8.5}
                fill="#94a3b8"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
