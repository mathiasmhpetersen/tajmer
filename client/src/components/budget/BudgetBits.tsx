import { AlertTriangle } from "lucide-react";
import type { BudgetPaceStatus, BudgetWarning } from "@shared/budget";
import { cn } from "@/lib/cn";
import { PACE_LABEL, PACE_TONE, WARNING_LABEL } from "@/lib/budget";

const PACE_CLASS: Record<"success" | "warning" | "muted", string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  muted: "bg-card-2 text-faint",
};

export function PaceChip({ status, pct }: { status: BudgetPaceStatus; pct?: number | null }) {
  const tone = PACE_TONE[status];
  const sign = pct != null && pct > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium",
        PACE_CLASS[tone],
      )}
    >
      {PACE_LABEL[status]}
      {status !== "no_data" && pct != null && Number.isFinite(pct) && (
        <span className="tnum opacity-80">
          {sign}
          {Math.round(pct)}%
        </span>
      )}
    </span>
  );
}

/** Spend vs budget. Fills accent; turns amber past 100% (overspend). */
export function ProgressBar({ value, max }: { value: number; max: number | null }) {
  const ratio = max && max > 0 ? value / max : 0;
  const pct = Math.min(1, Math.max(0, ratio));
  const over = ratio > 1;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-card-2">
      <div
        className={cn("h-full rounded-full", over ? "bg-warning" : "bg-accent")}
        style={{ width: `${(over ? 1 : pct) * 100}%` }}
      />
    </div>
  );
}

export function WarningChips({ warnings }: { warnings: BudgetWarning[] }) {
  if (warnings.length === 0) {
    return <p className="text-sm text-muted">Ingen advarsler.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {warnings.map((w, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-xl border border-hairline bg-card px-3.5 py-2.5"
        >
          <span className="mt-0.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
            <AlertTriangle className="size-3" />
            {WARNING_LABEL[w.code]}
          </span>
          <span className="text-[13px] leading-snug text-muted">{w.message}</span>
        </li>
      ))}
    </ul>
  );
}
