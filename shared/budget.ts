// Budget feature types. The server computes every number (REGNEREGLER) and the
// client only renders. Read-only; admin only. Never expose spend/results to the
// client role, and never use the words ROAS/køb.

export type BudgetWarningCode =
  | "not_configured" // CSV URL(s) missing
  | "sheet_unavailable" // a CSV could not be fetched
  | "unknown_artist" // a Plan/Tiltag row's Artist didn't match shared/artists.ts
  | "bad_date" // a Fra/Til date could not be parsed as dd/mm/yyyy
  | "pause" // a PAUSE segment
  | "note_value" // a non-numeric daily amount kept as a note
  | "daily_sum_mismatch" // sum(dagsbudget × dage) != periodebudget
  | "template_duplicate" // identical day-series shared across artists
  | "missing_start" // period doesn't cover the start of the plan window
  | "overspend" // brugt > aftalt
  | "missing_data";

export type BudgetWarningCategory = "forbrug" | "plan" | "periode" | "ark";

export interface BudgetWarning {
  code: BudgetWarningCode;
  category: BudgetWarningCategory;
  /** The problem (white line). Danish. */
  message: string;
  /** The consequence / detail (grey line). */
  detail?: string | null;
  artistSlug?: string | null;
  values?: Record<string, string | number | null>;
}

/** A stretch of days inside a period, carrying one daily amount. */
export interface BudgetSegment {
  from: string | null; // ISO
  to: string | null;
  fromLabel: string; // raw dd/mm/yyyy
  toLabel: string;
  days: number | null;
  dailyBudget: number | null;
  pause: boolean;
  note: string | null;
}

/** One Periode (label) for one artist: several segments, ONE periodebudget. */
export interface BudgetPeriod {
  artistSlug: string | null;
  artistLabel: string;
  label: string; // the "Periode" etiket, e.g. "17/11-23/12"
  from: string | null; // earliest segment start
  to: string | null; // latest segment end
  periodBudget: number | null; // first Periodebudget seen for (artist, periode)
  type: string | null;
  note: string | null;
  segments: BudgetSegment[];
  /** sum(dailyBudget × days) across segments, or null. */
  dailySum: number | null;
}

export interface BudgetAdjustment {
  artistSlug: string | null;
  date: string | null; // ISO — the day the daily budget changes
  fromDaily: number | null;
  toDaily: number | null;
  direction: "up" | "down" | "none";
}

export interface BudgetEvent {
  artistSlug: string | null; // null when it applies to everyone ("Alle")
  appliesToAll: boolean;
  artistLabel: string;
  from: string | null;
  to: string | null;
  fromLabel: string;
  toLabel: string;
  title: string;
  source: string | null; // Kilde
  recurrence: string; // raw Gentagelse
  occurrences: string[]; // expanded ISO dates
  // Optional richer Tiltag columns (present only in the extended layout).
  type?: string | null;
  handling?: string | null;
  status?: string | null;
}

export interface DailyPlanPoint {
  date: string; // ISO
  planned: number | null; // planned daily budget that day (null on pause)
  pause: boolean;
}

export interface DailySpendPoint {
  date: string; // ISO
  spend: number;
}

export interface MetaCampaignBudget {
  campaignId: string;
  campaignName: string;
  /** kr (minor units ÷ 100) — campaign-level, or null when it's on ad sets. */
  dailyBudget: number | null;
  /** Summed ad-set daily budgets (kr), used when campaign-level is null. */
  adsetDailyBudget: number | null;
  status: string;
}

/** "Kører nu" — the total daily budget actually live in Meta right now. */
export interface KoererNu {
  amount: number | null;
  /** True when the budget lives on ad sets, not the campaign. */
  onAdset: boolean;
}

export type TempoStatus = "on_track" | "behind" | "ahead" | "critical" | "no_data";

export interface BudgetTempo {
  status: TempoStatus;
  /** "På sporet" / "3 point bagud" / "5 point foran" / "7 point foran · tom 20/12". */
  text: string;
  /** (forbrugt_pct − forventet_pct) in percentage points. */
  afvigelse: number | null;
}

/** The current period's numbers, computed per REGNEREGLER. */
export interface BudgetCalc {
  periodLabel: string | null;
  from: string | null;
  to: string | null;
  aftalt: number | null;
  brugt: number;
  rest: number | null;
  dageIAlt: number | null;
  dageGaaet: number | null;
  dageTilbage: number | null;
  skalPrDag: number | null;
  koererNu: KoererNu;
  forbrugtPct: number | null; // 0..1
  forventetPct: number | null; // 0..1
  afvigelse: number | null; // percentage points
  avg7: number | null; // avg daily spend, last 7 days
  tomDato: string | null; // ISO, when money runs out
  tempo: BudgetTempo;
}

export interface BudgetSuggestionRow {
  from: string;
  to: string;
  why: string;
  perDag: number;
  current: boolean;
}

export interface BudgetSuggestion {
  rows: BudgetSuggestionRow[];
  total: number;
  rest: number | null;
}

export interface PaydayMarker {
  date: string; // ISO — 2nd-to-last weekday of the month
  monthLabel: string; // "november"
}

export interface ArtistShow {
  show: string | null;
  premiere: string | null; // ISO
}

/** Response for GET /api/budget/artist/[slug]. */
export interface ArtistBudget {
  slug: string;
  name: string;
  show: ArtistShow;
  periods: BudgetPeriod[];
  currentPeriodLabel: string | null;
  calc: BudgetCalc;
  dailyPlan: DailyPlanPoint[];
  dailySpend: DailySpendPoint[];
  adjustments: BudgetAdjustment[];
  metaDailyBudgets: MetaCampaignBudget[];
  suggestion: BudgetSuggestion;
  paydays: PaydayMarker[];
  events: BudgetEvent[];
  warnings: BudgetWarning[];
}

export interface BudgetArtistSummary {
  slug: string;
  name: string;
  periodLabel: string | null;
  from: string | null;
  to: string | null;
  aftalt: number | null;
  brugt: number;
  rest: number | null;
  forbrugtPct: number | null;
  forventetPct: number | null;
  skalPrDag: number | null;
  koererNu: KoererNu;
  tomDato: string | null;
  tempo: BudgetTempo;
  warningCount: number;
  /** Higher = more critical, for sorting the table. */
  criticality: number;
}

export type NextAdjustmentKind = "budget" | "event" | "payday";

export interface BudgetNextAdjustment {
  artistSlug: string | null;
  artistName: string;
  date: string; // ISO
  kind: NextAdjustmentKind;
  title: string | null;
  fromDaily: number | null;
  toDaily: number | null;
}

/** Response for GET /api/budget/overview. */
export interface BudgetOverviewResponse {
  generatedAt: string;
  totals: {
    aftalt: number;
    brugt: number;
    rest: number;
    skalPrDag: number;
    koererNu: number;
  };
  artists: BudgetArtistSummary[];
  nextAdjustments: BudgetNextAdjustment[];
  warnings: BudgetWarning[];
}
