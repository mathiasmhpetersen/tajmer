import type { BudgetTempo, BudgetWarning } from "@shared/budget";
import { BC, CATEGORY_HEX, CATEGORY_LABEL, TEMPO_HEX } from "@/lib/budget";

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function TempoBadge({ tempo }: { tempo: BudgetTempo }) {
  const color = TEMPO_HEX[tempo.status];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium"
      style={{ color, background: withAlpha(color, 0.14) }}
    >
      {tempo.text}
    </span>
  );
}

/** "Forbrug mod plan": fill = forbrugt_pct (tempo colour), white marker = forventet_pct. */
export function PlanBar({
  forbrugtPct,
  forventetPct,
  tempo,
}: {
  forbrugtPct: number | null;
  forventetPct: number | null;
  tempo: BudgetTempo;
}) {
  const color = TEMPO_HEX[tempo.status];
  const fill = Math.min(1, Math.max(0, forbrugtPct ?? 0));
  const marker = forventetPct != null ? Math.min(1, Math.max(0, forventetPct)) : null;
  return (
    <div className="min-w-[160px]">
      <div className="relative h-1.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${fill * 100}%`, background: color }}
        />
        {marker != null && (
          <div
            className="absolute w-0.5 rounded"
            style={{ left: `${marker * 100}%`, top: -3, bottom: -3, background: BC.text }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-1.5 text-[12px]" style={{ color }}>
        {tempo.text}
      </div>
    </div>
  );
}

export function KpiTile({
  label,
  value,
  context,
  accent = false,
  color,
}: {
  label: string;
  value: string;
  context?: React.ReactNode;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-[14px] p-6"
      style={{
        background: BC.card,
        border: `1px solid ${accent ? BC.orange : BC.border}`,
        minHeight: 132,
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: BC.textGrey }}
      >
        {label}
      </div>
      <div
        className="tnum mt-5 text-[36px] font-semibold leading-none"
        style={{ letterSpacing: "-0.02em", color: color ?? (accent ? BC.orange : BC.text) }}
      >
        {value}
      </div>
      {context != null && (
        <div className="mt-2 text-[13px]" style={{ color: BC.textGrey }}>
          {context}
        </div>
      )}
    </div>
  );
}

export function AlarmBar({
  problem,
  consequence,
  action,
}: {
  problem: string;
  consequence: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[14px] p-5 sm:flex-row sm:items-center sm:justify-between"
      style={{ background: BC.alarm, border: `1px solid ${withAlpha(BC.red, 0.4)}` }}
    >
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden style={{ color: BC.red, flexShrink: 0, marginTop: 2 }}>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
          />
        </svg>
        <div>
          <div className="text-[14px] font-semibold" style={{ color: BC.text }}>
            {problem}
          </div>
          <div className="mt-0.5 text-[13px]" style={{ color: BC.textGrey }}>
            {consequence}
          </div>
        </div>
      </div>
      {action &&
        (action.href ? (
          <a
            href={action.href}
            className="shrink-0 whitespace-nowrap rounded-[8px] px-4 py-2 text-[13px] font-medium"
            style={{ background: BC.orange, color: "#1A0F06" }}
          >
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 whitespace-nowrap rounded-[8px] px-4 py-2 text-[13px] font-medium"
            style={{ background: BC.orange, color: "#1A0F06" }}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

export function WarningList({ warnings }: { warnings: BudgetWarning[] }) {
  if (warnings.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: BC.textGrey }}>
        Ingen advarsler.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {warnings.map((w, i) => {
        const color = CATEGORY_HEX[w.category];
        return (
          <li
            key={i}
            className="flex items-start gap-3 rounded-[12px] p-3.5"
            style={{ background: BC.card, border: `1px solid ${BC.borderFaint}` }}
          >
            <span
              className="mt-0.5 shrink-0 whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color, background: withAlpha(color, 0.14) }}
            >
              {CATEGORY_LABEL[w.category]}
            </span>
            <div className="min-w-0">
              <div className="text-[13px]" style={{ color: BC.text }}>
                {w.message}
              </div>
              {w.detail && (
                <div className="mt-0.5 text-[12px]" style={{ color: BC.textGrey }}>
                  {w.detail}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
