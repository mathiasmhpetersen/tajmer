import type {
  ArtistBudget,
  BudgetPaceStatus,
  BudgetPeriod,
  BudgetWarningCode,
} from "@shared/budget";

const DAY_MS = 86_400_000;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO yyyy-mm-dd → "17/11" (dd/mm, Danish). */
export function ddmm(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** ISO yyyy-mm-dd → "17/11/2025". */
export function ddmmyyyy(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const PACE_LABEL: Record<BudgetPaceStatus, string> = {
  ahead: "Foran",
  behind: "Bagud",
  on_track: "På sporet",
  no_data: "Ingen data",
};

/** on_track is good (green); off-plan is amber; no data is neutral. */
export const PACE_TONE: Record<BudgetPaceStatus, "success" | "warning" | "muted"> = {
  ahead: "warning",
  behind: "warning",
  on_track: "success",
  no_data: "muted",
};

export const WARNING_LABEL: Record<BudgetWarningCode, string> = {
  not_configured: "Ikke opsat",
  sheet_unavailable: "Ark utilgængeligt",
  unknown_artist: "Ukendt kunstner",
  bad_date: "Ugyldig dato",
  pause: "Pause",
  note_value: "Tekstværdi",
  daily_sum_mismatch: "Budget passer ikke",
  template_duplicate: "Mistænkt skabelon",
  missing_data: "Manglende data",
  duplicate_week_label: "Dublet-uge",
  negative_delta: "Negativ udvikling",
};

export interface ArtistBudgetSummary {
  current: BudgetPeriod | null;
  periodBudget: number | null;
  spentInPeriod: number;
  remaining: number | null;
  expectedToDate: number | null;
  /** (spent / expected − 1) × 100, or null when there's no plan pace. */
  tempoPct: number | null;
  status: BudgetPaceStatus;
}

function daysInclusive(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS) + 1;
}

/** KPIs for the artist detail view, computed from the raw budget payload. */
export function deriveArtistSummary(b: ArtistBudget): ArtistBudgetSummary {
  const today = todayIso();
  const current =
    b.periods.filter((p) => p.from && p.to && p.from <= today && p.to >= today).at(-1) ?? null;

  if (!current || !current.from) {
    return {
      current,
      periodBudget: current?.periodBudget ?? null,
      spentInPeriod: 0,
      remaining: null,
      expectedToDate: null,
      tempoPct: null,
      status: "no_data",
    };
  }

  let spentInPeriod = 0;
  for (const point of b.dailySpend) {
    if (point.date >= current.from && (!current.to || point.date <= current.to)) {
      spentInPeriod += point.spend;
    }
  }

  const periodBudget = current.periodBudget;
  const remaining = periodBudget != null ? periodBudget - spentInPeriod : null;

  let expectedToDate: number | null = null;
  let tempoPct: number | null = null;
  let status: BudgetPaceStatus = "no_data";
  if (!current.pause && current.dailyBudget != null) {
    const end = current.to && current.to < today ? current.to : today;
    const elapsed = Math.max(1, daysInclusive(current.from, end));
    expectedToDate = current.dailyBudget * elapsed;
    if (expectedToDate > 0) {
      tempoPct = (spentInPeriod / expectedToDate - 1) * 100;
      status = spentInPeriod > expectedToDate * 1.05 ? "ahead" : spentInPeriod < expectedToDate * 0.95 ? "behind" : "on_track";
    }
  }

  return { current, periodBudget, spentInPeriod, remaining, expectedToDate, tempoPct, status };
}
