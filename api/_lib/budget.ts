import { ARTISTS, ARTISTS_BY_SLUG, artistForCampaign } from "../../shared/artists.js";
import type {
  ArtistBudget,
  BudgetArtistSummary,
  BudgetOverviewResponse,
  BudgetPaceStatus,
  BudgetPeriod,
  BudgetWarning,
  DailySpendPoint,
  MetaCampaignBudget,
} from "../../shared/budget.js";
import { fetchCsv } from "./budget-csv.js";
import { buildDailyPlan, deriveAdjustments, parsePlan, parseTiltag } from "./budget-plan.js";
import {
  fetchCampaignDailyBudgets,
  fetchDailySpend,
  type CampaignDailyBudget,
  type CampaignDailySpend,
} from "./meta.js";

const DAY_MS = 86_400_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether the client role may read /api/budget/*. Off by default (admin only);
 * flip BUDGET_CLIENT_ENABLED to switch on a future client view without a deploy.
 */
export function budgetClientEnabled(): boolean {
  const v = process.env.BUDGET_CLIENT_ENABLED;
  return v === "1" || v === "true";
}

/** Meta spend window: earliest plan start → min(today, latest plan end). */
function spendWindow(periods: BudgetPeriod[]): { from: string | null; to: string | null } {
  const dated = periods.filter((p) => p.from && p.to);
  const today = todayIso();
  if (dated.length === 0) {
    return { from: new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10), to: today };
  }
  let min = dated[0].from as string;
  let max = dated[0].to as string;
  for (const p of dated) {
    if ((p.from as string) < min) min = p.from as string;
    if ((p.to as string) > max) max = p.to as string;
  }
  return { from: min, to: max > today ? today : max };
}

interface SheetData {
  plan: ReturnType<typeof parsePlan>;
  tiltag: ReturnType<typeof parseTiltag>;
  warnings: BudgetWarning[];
}

async function loadSheets(): Promise<SheetData> {
  const warnings: BudgetWarning[] = [];
  const planUrl = process.env.PLAN_CSV_URL;
  const tiltagUrl = process.env.TILTAG_CSV_URL;
  let planRows: string[][] = [];
  let tiltagRows: string[][] = [];

  if (!planUrl) {
    warnings.push({
      code: "not_configured",
      message: "PLAN_CSV_URL mangler — budgetdata kan ikke hentes.",
    });
  } else {
    try {
      planRows = await fetchCsv(planUrl);
    } catch (e) {
      warnings.push({
        code: "sheet_unavailable",
        message: `Kunne ikke hente Plan-CSV: ${(e as Error).message}`,
      });
    }
  }

  if (!tiltagUrl) {
    warnings.push({
      code: "not_configured",
      message: "TILTAG_CSV_URL mangler — tiltag vises ikke.",
    });
  } else {
    try {
      tiltagRows = await fetchCsv(tiltagUrl);
    } catch (e) {
      warnings.push({
        code: "sheet_unavailable",
        message: `Kunne ikke hente Tiltag-CSV: ${(e as Error).message}`,
      });
    }
  }

  return { plan: parsePlan(planRows), tiltag: parseTiltag(tiltagRows), warnings };
}

async function safeDailySpend(
  from: string | null,
  to: string | null,
  warnings: BudgetWarning[],
): Promise<CampaignDailySpend[]> {
  if (!from || !to) return [];
  try {
    return await fetchDailySpend(from, to);
  } catch (e) {
    warnings.push({
      code: "missing_data",
      message: `Kunne ikke hente Meta-forbrug: ${(e as Error).message}`,
    });
    return [];
  }
}

async function safeBudgets(warnings: BudgetWarning[]): Promise<CampaignDailyBudget[]> {
  try {
    return await fetchCampaignDailyBudgets();
  } catch (e) {
    warnings.push({
      code: "missing_data",
      message: `Kunne ikke hente Meta-dagsbudgetter: ${(e as Error).message}`,
    });
    return [];
  }
}

/** Sum campaign spend into per-artist, per-date points. */
function spendByArtistDate(spend: CampaignDailySpend[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of spend) {
    const slug = artistForCampaign(s.campaignName)?.slug;
    if (!slug) continue;
    let byDate = out.get(slug);
    if (!byDate) {
      byDate = new Map();
      out.set(slug, byDate);
    }
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.spend);
  }
  return out;
}

function toSortedPoints(byDate: Map<string, number> | undefined): DailySpendPoint[] {
  if (!byDate) return [];
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, spend]) => ({ date, spend }));
}

// ---------------------------------------------------------------------------
// GET /api/budget/artist/[slug]
// ---------------------------------------------------------------------------

export function isKnownArtist(slug: string): boolean {
  return Boolean(ARTISTS_BY_SLUG[slug]);
}

export async function buildArtistBudget(slug: string): Promise<ArtistBudget> {
  const artist = ARTISTS_BY_SLUG[slug];
  const { plan, tiltag, warnings: sheetWarnings } = await loadSheets();

  const periods = plan.periods.filter((p) => p.artistSlug === slug);
  const events = tiltag.events.filter((e) => e.artistSlug === slug);

  const metaWarnings: BudgetWarning[] = [];
  const window = spendWindow(periods);
  const [spend, budgets] = await Promise.all([
    safeDailySpend(window.from, window.to, metaWarnings),
    safeBudgets(metaWarnings),
  ]);

  const dailySpend = toSortedPoints(spendByArtistDate(spend).get(slug));
  const metaDailyBudgets: MetaCampaignBudget[] = budgets
    .filter((b) => artistForCampaign(b.campaignName)?.slug === slug)
    .map((b) => ({
      campaignId: b.campaignId,
      campaignName: b.campaignName,
      dailyBudget: b.dailyBudget,
      status: b.status,
    }));

  const warnings: BudgetWarning[] = [
    ...sheetWarnings,
    ...plan.warnings.filter((w) => w.artistSlug === slug),
    ...tiltag.warnings.filter((w) => w.artistSlug === slug),
    ...metaWarnings,
  ];

  return {
    slug,
    name: artist.name,
    periods,
    adjustments: deriveAdjustments(periods),
    dailyPlan: buildDailyPlan(periods),
    dailySpend,
    metaDailyBudgets,
    events,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// GET /api/budget/overview
// ---------------------------------------------------------------------------

function paceStatus(
  currentPeriod: BudgetPeriod | null,
  spentInPeriod: number,
): BudgetPaceStatus {
  if (!currentPeriod || currentPeriod.pause || currentPeriod.dailyBudget == null) return "no_data";
  if (!currentPeriod.from) return "no_data";
  const today = todayIso();
  const start = currentPeriod.from;
  const elapsed =
    Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
  if (elapsed <= 0) return "no_data";
  const expected = currentPeriod.dailyBudget * elapsed;
  if (expected <= 0) return "no_data";
  if (spentInPeriod > expected * 1.05) return "ahead";
  if (spentInPeriod < expected * 0.95) return "behind";
  return "on_track";
}

export async function buildBudgetOverview(): Promise<BudgetOverviewResponse> {
  const { plan, tiltag, warnings: sheetWarnings } = await loadSheets();

  const metaWarnings: BudgetWarning[] = [];
  const window = spendWindow(plan.periods);
  const spend = await safeDailySpend(window.from, window.to, metaWarnings);
  const byArtistDate = spendByArtistDate(spend);
  const today = todayIso();

  const artists: BudgetArtistSummary[] = ARTISTS.map((a) => {
    const periods = plan.periods.filter((p) => p.artistSlug === a.slug);
    const byDate = byArtistDate.get(a.slug);
    const spentTotal = byDate ? [...byDate.values()].reduce((s, v) => s + v, 0) : 0;

    const budgetValues = periods.map((p) => p.periodBudget).filter((v): v is number => v != null);
    const periodBudgetTotal = budgetValues.length
      ? budgetValues.reduce((s, v) => s + v, 0)
      : null;

    const current =
      periods.filter((p) => p.from && p.to && p.from <= today && p.to >= today).at(-1) ?? null;

    let spentInPeriod = 0;
    if (current?.from && byDate) {
      for (const [date, v] of byDate) {
        if (date >= current.from && (!current.to || date <= current.to)) spentInPeriod += v;
      }
    }

    const warningCount =
      plan.warnings.filter((w) => w.artistSlug === a.slug).length +
      tiltag.warnings.filter((w) => w.artistSlug === a.slug).length;

    return {
      slug: a.slug,
      name: a.name,
      periodBudgetTotal,
      spentTotal,
      remaining: periodBudgetTotal != null ? periodBudgetTotal - spentTotal : null,
      currentPeriod: current
        ? {
            from: current.from,
            to: current.to,
            periodBudget: current.periodBudget,
            dailyBudget: current.dailyBudget,
            pause: current.pause,
          }
        : null,
      status: paceStatus(current, spentInPeriod),
      warningCount,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    artists,
    warnings: [...sheetWarnings, ...plan.warnings, ...tiltag.warnings, ...metaWarnings],
  };
}
