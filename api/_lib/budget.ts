import { ARTISTS, ARTISTS_BY_SLUG, artistForCampaign } from "../../shared/artists.js";
import type {
  ArtistBudget,
  BudgetArtistSummary,
  BudgetEvent,
  BudgetNextAdjustment,
  BudgetOverviewResponse,
  BudgetPeriod,
  BudgetWarning,
  DailySpendPoint,
  KoererNu,
  MetaCampaignBudget,
  PaydayMarker,
} from "../../shared/budget.js";
import { fetchCsv } from "./budget-csv.js";
import {
  addDaysIso,
  artistShowFromEvents,
  buildDailyPlan,
  deriveAdjustments,
  parsePlan,
  parseTiltag,
  paydaysInWindow,
} from "./budget-plan.js";
import { buildSuggestion, computeCalc, criticalityOf } from "./budget-calc.js";
import {
  fetchAdsetDailyBudgets,
  fetchCampaignDailyBudgets,
  fetchDailySpend,
  type AdsetDailyBudget,
  type CampaignDailyBudget,
  type CampaignDailySpend,
} from "./meta.js";

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

export function isKnownArtist(slug: string): boolean {
  return Boolean(ARTISTS_BY_SLUG[slug]);
}

// ---------------------------------------------------------------------------
// Loading (CSV + Meta), tolerant to missing sources.
// ---------------------------------------------------------------------------

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
      category: "ark",
      message: "PLAN_CSV_URL mangler — budgetdata kan ikke hentes.",
    });
  } else {
    try {
      planRows = await fetchCsv(planUrl);
    } catch (e) {
      warnings.push({
        code: "sheet_unavailable",
        category: "ark",
        message: `Kunne ikke hente Plan-CSV: ${(e as Error).message}`,
      });
    }
  }

  if (!tiltagUrl) {
    warnings.push({
      code: "not_configured",
      category: "ark",
      message: "TILTAG_CSV_URL mangler — tiltag vises ikke.",
    });
  } else {
    try {
      tiltagRows = await fetchCsv(tiltagUrl);
    } catch (e) {
      warnings.push({
        code: "sheet_unavailable",
        category: "ark",
        message: `Kunne ikke hente Tiltag-CSV: ${(e as Error).message}`,
      });
    }
  }

  return { plan: parsePlan(planRows), tiltag: parseTiltag(tiltagRows), warnings };
}

interface MetaData {
  spend: CampaignDailySpend[];
  campaigns: CampaignDailyBudget[];
  adsets: AdsetDailyBudget[];
  warnings: BudgetWarning[];
}

async function loadMeta(from: string | null, to: string | null): Promise<MetaData> {
  const warnings: BudgetWarning[] = [];
  const metaWarn = (message: string): BudgetWarning => ({ code: "missing_data", category: "ark", message });

  const [spend, campaigns, adsets] = await Promise.all([
    from && to
      ? fetchDailySpend(from, to).catch((e) => {
          warnings.push(metaWarn(`Kunne ikke hente Meta-forbrug: ${(e as Error).message}`));
          return [] as CampaignDailySpend[];
        })
      : Promise.resolve([] as CampaignDailySpend[]),
    fetchCampaignDailyBudgets().catch((e) => {
      warnings.push(metaWarn(`Kunne ikke hente Meta-dagsbudgetter: ${(e as Error).message}`));
      return [] as CampaignDailyBudget[];
    }),
    fetchAdsetDailyBudgets().catch((e) => {
      warnings.push(metaWarn(`Kunne ikke hente Meta-annoncesæt: ${(e as Error).message}`));
      return [] as AdsetDailyBudget[];
    }),
  ]);

  return { spend, campaigns, adsets, warnings };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function planWindow(periods: BudgetPeriod[]): { from: string | null; to: string | null } {
  const dated = periods.filter((p) => p.from);
  const today = todayIso();
  if (dated.length === 0) return { from: addDaysIso(today, -30), to: today };
  let min = dated[0].from as string;
  for (const p of dated) if ((p.from as string) < min) min = p.from as string;
  return { from: min, to: today };
}

/** The period in progress today, else the next upcoming, else the latest. */
function pickCurrent(periods: BudgetPeriod[], today: string): BudgetPeriod | null {
  const dated = periods.filter((p) => p.from && p.to);
  if (dated.length === 0) return periods[0] ?? null;
  const ongoing = dated.filter((p) => (p.from as string) <= today && (p.to as string) >= today);
  if (ongoing.length) return ongoing[ongoing.length - 1];
  const upcoming = dated.filter((p) => (p.from as string) > today).sort((a, b) => ((a.from as string) < (b.from as string) ? -1 : 1));
  if (upcoming.length) return upcoming[0];
  return dated.sort((a, b) => ((a.to as string) < (b.to as string) ? 1 : -1))[0];
}

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

function artistSpendPoints(byDate: Map<string, number> | undefined): DailySpendPoint[] {
  if (!byDate) return [];
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, spend]) => ({ date, spend }));
}

/** "Kører nu" + the per-campaign budget rows for one artist. */
function koererNuFor(
  slug: string,
  campaigns: CampaignDailyBudget[],
  adsets: AdsetDailyBudget[],
): { koererNu: KoererNu; rows: MetaCampaignBudget[] } {
  const mine = campaigns.filter((c) => artistForCampaign(c.campaignName)?.slug === slug);
  const campIds = new Set(mine.map((c) => c.campaignId));
  const myAdsets = adsets.filter((a) => a.campaignId && campIds.has(a.campaignId));

  const rows: MetaCampaignBudget[] = mine.map((c) => {
    const sets = myAdsets.filter((a) => a.campaignId === c.campaignId);
    const adsetSum = sets.some((a) => a.dailyBudget != null)
      ? sets.reduce((s, a) => s + (a.dailyBudget ?? 0), 0)
      : null;
    return {
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      dailyBudget: c.dailyBudget,
      adsetDailyBudget: adsetSum,
      status: c.status,
    };
  });

  const activeCampaigns = mine.filter((c) => c.status === "ACTIVE");
  const hasCampaignBudget = activeCampaigns.some((c) => c.dailyBudget != null);
  if (hasCampaignBudget) {
    return {
      koererNu: { amount: activeCampaigns.reduce((s, c) => s + (c.dailyBudget ?? 0), 0), onAdset: false },
      rows,
    };
  }
  const activeAdsets = myAdsets.filter((a) => a.status === "ACTIVE" && a.dailyBudget != null);
  if (activeAdsets.length) {
    return { koererNu: { amount: activeAdsets.reduce((s, a) => s + (a.dailyBudget ?? 0), 0), onAdset: true }, rows };
  }
  return { koererNu: { amount: null, onAdset: false }, rows };
}

function eventsForArtist(events: BudgetEvent[], slug: string): BudgetEvent[] {
  return events.filter((e) => e.appliesToAll || e.artistSlug === slug);
}

// ---------------------------------------------------------------------------
// GET /api/budget/artist/[slug]
// ---------------------------------------------------------------------------

export async function buildArtistBudget(slug: string): Promise<ArtistBudget> {
  const artist = ARTISTS_BY_SLUG[slug];
  const today = todayIso();
  const { plan, tiltag, warnings: sheetWarnings } = await loadSheets();

  const periods = plan.periods.filter((p) => p.artistSlug === slug);
  const events = eventsForArtist(tiltag.events, slug);

  const window = planWindow(periods);
  const { spend, campaigns, adsets, warnings: metaWarnings } = await loadMeta(window.from, window.to);

  const dailySpend = artistSpendPoints(spendByArtistDate(spend).get(slug));
  const { koererNu, rows: metaDailyBudgets } = koererNuFor(slug, campaigns, adsets);

  const current = pickCurrent(periods, today);
  const calc = computeCalc(current, dailySpend, koererNu, today);
  const suggestion = buildSuggestion(calc, today);

  const paydays: PaydayMarker[] =
    current?.from && current?.to ? paydaysInWindow(current.from, current.to) : [];

  const warnings: BudgetWarning[] = [
    ...sheetWarnings,
    ...plan.warnings.filter((w) => w.artistSlug === slug),
    ...tiltag.warnings.filter((w) => w.artistSlug === slug),
    ...metaWarnings,
  ];
  if (calc.rest != null && calc.rest < 0) {
    warnings.unshift({
      code: "overspend",
      category: "forbrug",
      message: `${artist.name} har brugt mere end aftalt i perioden.`,
      detail: `Overforbrug ${Math.round(-calc.rest)} kr.`,
      artistSlug: slug,
    });
  }

  return {
    slug,
    name: artist.name,
    show: artistShowFromEvents(tiltag.events, slug),
    periods,
    currentPeriodLabel: current?.label ?? null,
    calc,
    dailyPlan: buildDailyPlan(periods),
    dailySpend,
    adjustments: deriveAdjustments(periods),
    metaDailyBudgets,
    suggestion,
    paydays,
    events,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// GET /api/budget/overview
// ---------------------------------------------------------------------------

export async function buildBudgetOverview(): Promise<BudgetOverviewResponse> {
  const today = todayIso();
  const { plan, tiltag, warnings: sheetWarnings } = await loadSheets();

  const window = planWindow(plan.periods);
  const { spend, campaigns, adsets, warnings: metaWarnings } = await loadMeta(window.from, window.to);
  const byArtistDate = spendByArtistDate(spend);

  const artists: BudgetArtistSummary[] = ARTISTS.map((a) => {
    const periods = plan.periods.filter((p) => p.artistSlug === a.slug);
    const dailySpend = artistSpendPoints(byArtistDate.get(a.slug));
    const { koererNu } = koererNuFor(a.slug, campaigns, adsets);
    const current = pickCurrent(periods, today);
    const calc = computeCalc(current, dailySpend, koererNu, today);
    const warningCount = [...plan.warnings, ...tiltag.warnings].filter((w) => w.artistSlug === a.slug).length;

    return {
      slug: a.slug,
      name: a.name,
      periodLabel: calc.periodLabel,
      from: calc.from,
      to: calc.to,
      aftalt: calc.aftalt,
      brugt: calc.brugt,
      rest: calc.rest,
      forbrugtPct: calc.forbrugtPct,
      forventetPct: calc.forventetPct,
      skalPrDag: calc.skalPrDag,
      koererNu: calc.koererNu,
      tomDato: calc.tomDato,
      tempo: calc.tempo,
      warningCount,
      criticality: criticalityOf(calc.tempo.status),
    };
  }).sort((x, y) => y.criticality - x.criticality || (y.tempo.afvigelse ?? 0) - (x.tempo.afvigelse ?? 0));

  const totals = artists.reduce(
    (acc, a) => ({
      aftalt: acc.aftalt + (a.aftalt ?? 0),
      brugt: acc.brugt + a.brugt,
      rest: acc.rest + (a.rest ?? 0),
      skalPrDag: acc.skalPrDag + (a.skalPrDag ?? 0),
      koererNu: acc.koererNu + (a.koererNu.amount ?? 0),
    }),
    { aftalt: 0, brugt: 0, rest: 0, skalPrDag: 0, koererNu: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    totals,
    artists,
    nextAdjustments: buildNextAdjustments(plan.periods, tiltag.events, today),
    warnings: [...sheetWarnings, ...plan.warnings, ...tiltag.warnings, ...metaWarnings],
  };
}

function buildNextAdjustments(
  periods: BudgetPeriod[],
  events: BudgetEvent[],
  today: string,
): BudgetNextAdjustment[] {
  const nameOf = (slug: string | null) => (slug ? ARTISTS_BY_SLUG[slug]?.name ?? "" : "Alle");
  const items: BudgetNextAdjustment[] = [];

  for (const adj of deriveAdjustments(periods)) {
    if (adj.date && adj.date >= today) {
      items.push({
        artistSlug: adj.artistSlug,
        artistName: nameOf(adj.artistSlug),
        date: adj.date,
        kind: "budget",
        title: null,
        fromDaily: adj.fromDaily,
        toDaily: adj.toDaily,
      });
    }
  }

  for (const e of events) {
    const next = [...e.occurrences].filter((d) => d >= today).sort()[0] ?? (e.from && e.from >= today ? e.from : null);
    if (next) {
      items.push({
        artistSlug: e.artistSlug,
        artistName: e.appliesToAll ? "Alle" : nameOf(e.artistSlug),
        date: next,
        kind: "event",
        title: e.title,
        fromDaily: null,
        toDaily: null,
      });
    }
  }

  for (const pd of paydaysInWindow(today, addDaysIso(today, 60))) {
    items.push({
      artistSlug: null,
      artistName: "Alle",
      date: pd.date,
      kind: "payday",
      title: `Lønningsdag (${pd.monthLabel})`,
      fromDaily: null,
      toDaily: null,
    });
  }

  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 3);
}
