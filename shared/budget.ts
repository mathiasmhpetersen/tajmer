// Budget feature types. PR1 populates plan/tiltag/daily-spend/meta-daily-budgets
// plus a flat `warnings` array. The shapes already carry per-day and per-week
// series so PR3 (tickets sold, per-city geo rows, week-over-week) can extend
// ArtistBudget without reworking the data layer.

export type BudgetWarningCode =
  | "not_configured" // Google Sheets credentials/sheet id missing
  | "sheet_unavailable" // a tab/sheet could not be read (e.g. not created yet)
  | "unknown_artist" // a Plan/Tiltag row's Artist didn't match shared/artists.ts
  | "bad_date" // a Fra/Til date could not be parsed as dd/mm/yyyy
  | "pause" // a PAUSE period (reported as pause, never 0)
  | "note_value" // a non-numeric amount kept as a note ("10000+3000 geo")
  | "daily_sum_mismatch" // dagsbudget × dage != periodebudget
  | "template_duplicate" // identical day-series shared across artists ("mistænkt skabelon")
  | "missing_data"
  | "duplicate_week_label" // PR3 (ticket sheets)
  | "negative_delta"; // PR3 (ticket refunds)

export interface BudgetWarning {
  code: BudgetWarningCode;
  /** Danish, human-readable. */
  message: string;
  artistSlug?: string | null;
  period?: { from: string | null; to: string | null } | null;
  /** The conflicting values and where each came from. */
  values?: Record<string, string | number | null>;
}

export interface BudgetPeriod {
  artistSlug: string | null;
  /** Raw "Artist" cell as written in the sheet. */
  artistLabel: string;
  /** ISO yyyy-mm-dd, or null when unparseable. */
  from: string | null;
  to: string | null;
  /** Original dd/mm/yyyy cell text. */
  fromLabel: string;
  toLabel: string;
  /** Inclusive day count, or null when either date is missing. */
  days: number | null;
  periodBudget: number | null;
  dailyBudget: number | null;
  /** dailyBudget × days, or null. */
  dailySum: number | null;
  type: string | null; // hoved / geo
  note: string | null;
  pause: boolean;
  rawPeriodBudget: string;
  rawDailyBudget: string;
}

export interface BudgetAdjustment {
  artistSlug: string | null;
  /** ISO date the daily budget should change (start of the new period). */
  date: string | null;
  fromDaily: number | null;
  toDaily: number | null;
  direction: "up" | "down" | "none";
}

export interface BudgetEvent {
  artistSlug: string | null;
  artistLabel: string;
  from: string | null;
  to: string | null;
  fromLabel: string;
  toLabel: string;
  title: string;
  source: string | null; // Kilde
  /** Raw "Gentagelse" cell. */
  recurrence: string;
  /** Expanded ISO dates the marker should appear on. */
  occurrences: string[];
}

export interface DailyPlanPoint {
  date: string; // ISO
  planned: number | null; // null on pause/no-plan days
  pause: boolean;
}

export interface DailySpendPoint {
  date: string; // ISO
  spend: number;
}

export interface MetaCampaignBudget {
  campaignId: string;
  campaignName: string;
  /** kr (Meta minor units ÷ 100), or null when the budget lives on the ad sets. */
  dailyBudget: number | null;
  status: string;
}

/** Response for GET /api/budget/artist/[slug]. */
export interface ArtistBudget {
  slug: string;
  name: string;
  periods: BudgetPeriod[];
  adjustments: BudgetAdjustment[];
  dailyPlan: DailyPlanPoint[];
  dailySpend: DailySpendPoint[];
  metaDailyBudgets: MetaCampaignBudget[];
  events: BudgetEvent[];
  warnings: BudgetWarning[];
  // PR3 will add: weeklyTickets, cityRows, metrics.
}

export type BudgetPaceStatus = "ahead" | "behind" | "on_track" | "no_data";

export interface BudgetArtistSummary {
  slug: string;
  name: string;
  /** Sum of the artist's period budgets (non-null), or null if none. */
  periodBudgetTotal: number | null;
  spentTotal: number;
  remaining: number | null;
  currentPeriod: {
    from: string | null;
    to: string | null;
    periodBudget: number | null;
    dailyBudget: number | null;
    pause: boolean;
  } | null;
  status: BudgetPaceStatus;
  warningCount: number;
}

/** Response for GET /api/budget/overview. */
export interface BudgetOverviewResponse {
  generatedAt: string;
  artists: BudgetArtistSummary[];
  warnings: BudgetWarning[];
}
