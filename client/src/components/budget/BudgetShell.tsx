import { BC, longDate, todayIso } from "@/lib/budget";

/** Danish integer: 1245 → "1.245". */
export function nf(n: number): string {
  return Math.round(n).toLocaleString("da-DK");
}

const SCOPES = [
  { value: "aftalt", label: "Aftalt periode", enabled: true },
  { value: "november", label: "November", enabled: false },
  { value: "tour", label: "Hele turnéen", enabled: false },
];

/** Segmented control. Only "Aftalt periode" is wired to data for now. */
export function SegControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-[10px] p-0.5" style={{ background: BC.card, border: `1px solid ${BC.border}` }}>
      {SCOPES.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            disabled={!s.enabled}
            title={s.enabled ? undefined : "Kommer snart"}
            onClick={() => s.enabled && onChange(s.value)}
            className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              color: active ? "#1A0F06" : s.enabled ? BC.textDim : BC.textFaint,
              background: active ? BC.orange : "transparent",
              cursor: s.enabled ? "pointer" : "not-allowed",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-medium"
      style={{ border: `1px solid ${BC.border}`, color: BC.textDim, background: BC.card }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden className={loading ? "animate-spin" : ""}>
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
      </svg>
      Opdater nu
    </button>
  );
}

export function BudgetHeader({
  title,
  subtitle,
  right,
  onRefresh,
  refreshing,
  back,
}: {
  title: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
  back?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ?? (
          <div className="text-[13px]" style={{ color: BC.textGrey }}>
            {longDate(todayIso())}
          </div>
        )}
        <h1 className="mt-1.5 text-[38px] font-semibold leading-[1.05]" style={{ letterSpacing: "-0.025em", color: BC.text }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-[14px]" style={{ color: BC.textGrey }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {right}
        <RefreshButton onClick={onRefresh} loading={refreshing} />
      </div>
    </header>
  );
}
