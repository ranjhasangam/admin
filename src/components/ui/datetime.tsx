"use client";

import { useEffect, useState } from "react";

type Mode = "datetime" | "date" | "time" | "relative";

function format(d: Date, mode: Mode): string {
  switch (mode) {
    case "date":
      return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    case "time":
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    case "relative": {
      const diff = Date.now() - d.getTime();
      const abs = Math.abs(diff);
      const mins = Math.round(abs / 60000);
      const suffix = diff >= 0 ? "ago" : "from now";
      if (abs < 45000) return "just now";
      if (mins < 60) return `${mins}m ${suffix}`;
      const hours = Math.round(mins / 60);
      if (hours < 24) return `${hours}h ${suffix}`;
      const days = Math.round(hours / 24);
      if (days < 30) return `${days}d ${suffix}`;
      return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    }
    default:
      return d.toLocaleString(undefined, {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
  }
}

/**
 * Timezone-safe date rendering:
 * the server pass renders a deterministic UTC-based string (no hydration
 * mismatch), then the browser localizes it after mount.
 */
export function DateTime({
  value,
  mode = "datetime",
  className = "",
}: {
  value: string | null | undefined;
  mode?: Mode;
  className?: string;
}) {
  const fallback = value
    ? value.slice(0, mode === "date" ? 10 : 16).replace("T", " ")
    : "—";
  const [text, setText] = useState(fallback);

  useEffect(() => {
    if (!value) {
      setText("—");
      return;
    }
    const d = new Date(value);
    setText(isNaN(d.getTime()) ? String(value) : format(d, mode));
  }, [value, mode]);

  return (
    <span className={className} suppressHydrationWarning title={value ?? undefined}>
      {text}
    </span>
  );
}
