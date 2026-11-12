import clsx from "clsx";
import type { ReactNode } from "react";

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "warn" | "bad" | "ok" }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className={clsx("mt-1 text-[26px] font-semibold leading-8 tabular-nums", tone === "warn" && "text-warn-fg", tone === "bad" && "text-bad-fg", tone === "ok" && "text-ok-fg")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/** Horizontal bars drawn with plain divs: one hue, values printed next to the bars. */
export function BarList({ rows, max, color = "bg-brand-500" }: { rows: { label: string; value: number }[]; max?: number; color?: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-4 text-sm text-ink-3">No data for this period.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[150px_1fr_44px] items-center gap-3 text-sm">
          <span className="truncate text-ink-2" title={r.label}>{r.label}</span>
          <span className="h-2 rounded-full bg-mute-bg"><span className={clsx("block h-2 rounded-full", color)} style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%` }} /></span>
          <span className="text-right tabular-nums text-ink">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}
