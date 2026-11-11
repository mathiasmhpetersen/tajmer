import type {
  BudgetCalc,
  BudgetPeriod,
  BudgetSuggestion,
  BudgetSuggestionRow,
  BudgetTempo,
  DailySpendPoint,
  KoererNu,
  PaydayMarker,
  TempoStatus,
} from "../../shared/budget.js";
import { addDaysIso, daysInclusive, payday } from "./budget-plan.js";

// The budget maths (REGNEREGLER) plus the tempo verdict and the "forslag til
// resten af perioden" heuristic. Pure — unit-tested in budget-calc.test.ts.

/** d/m with no leading zeros, e.g. "20/12". */
export function dm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

function sumSpendBetween(spend: DailySpendPoint[], fromIso: string, toIso: string): number {
  let s = 0;
  for (const p of spend) if (p.date >= fromIso && p.date <= toIso) s += p.spend;
  return s;
}

/** Average daily spend over the 7 days ending yesterday (missing days = 0). */
function avgLast7(spend: DailySpendPoint[], today: string): number | null {
  const yesterday = addDaysIso(today, -1);
  const start = addDaysIso(today, -7);
  let has = false;
  let sum = 0;
  for (const p of spend) {
    if (p.date >= start && p.date <= yesterday) {
      sum += p.spend;
      has = true;
    }
  }
  return has ? sum / 7 : null;
}

function tempoFor(afvigelse: number | null, tomDato: string | null, toIso: string | null): BudgetTempo {
  if (afvigelse == null) return { status: "no_data", text: "Ingen data", afvigelse: null };
  const n = Math.round(Math.abs(afvigelse));
  const foranBagud = afvigelse >= 0 ? `${n} point foran` : `${n} point bagud`;

  // Red wins: money runs out before the period ends.
  if (tomDato && toIso && tomDato < toIso) {
    return { status: "critical", text: `${foranBagud} · tom ${dm(tomDato)}`, afvigelse };
  }
  // Epsilon so a boundary like −5.0 isn't tipped over by float noise.
  if (afvigelse > 5 + 1e-6) return { status: "ahead", text: `${n} point foran`, afvigelse };
  if (afvigelse < -5 - 1e-6) return { status: "behind", text: `${n} point bagud`, afvigelse };
  return { status: "on_track", text: "På sporet", afvigelse };
}

export function computeCalc(
  period: BudgetPeriod | null,
  spend: DailySpendPoint[],
  koererNu: KoererNu,
  today: string,
): BudgetCalc {
  const empty: BudgetCalc = {
    periodLabel: period?.label ?? null,
    from: period?.from ?? null,
    to: period?.to ?? null,
    aftalt: period?.periodBudget ?? null,
    brugt: 0,
    rest: null,
    dageIAlt: null,
    dageGaaet: null,
    dageTilbage: null,
    skalPrDag: null,
    koererNu,
    forbrugtPct: null,
    forventetPct: null,
    afvigelse: null,
    avg7: null,
    tomDato: null,
    tempo: { status: "no_data", text: "Ingen data", afvigelse: null },
  };
  if (!period || !period.from || !period.to) return empty;

  const from = period.from;
  const to = period.to;
  const aftalt = period.periodBudget;
  const dageIAlt = daysInclusive(from, to);

  const yesterday = addDaysIso(today, -1);
  const brugtTo = yesterday < to ? yesterday : to;
  const brugt = today <= from ? 0 : sumSpendBetween(spend, from, brugtTo);

  const rest = aftalt != null ? aftalt - brugt : null;

  let dageGaaet: number;
  if (today < from) dageGaaet = 0;
  else if (today > to) dageGaaet = dageIAlt;
  else dageGaaet = daysInclusive(from, today);
  const dageTilbage = today > to ? 0 : dageIAlt - dageGaaet + 1;

  const skalPrDag = rest != null && dageTilbage > 0 ? rest / dageTilbage : null;
  const forbrugtPct = aftalt != null && aftalt > 0 ? brugt / aftalt : null;
  const forventetPct = dageIAlt > 0 ? dageGaaet / dageIAlt : null;
  const afvigelse = forbrugtPct != null && forventetPct != null ? (forbrugtPct - forventetPct) * 100 : null;

  const avg7 = avgLast7(spend, today);
  let tomDato: string | null = null;
  if (rest != null && avg7 != null && avg7 > 0) {
    tomDato = rest <= 0 ? today : addDaysIso(today, Math.round(rest / avg7));
  }

  return {
    periodLabel: period.label,
    from,
    to,
    aftalt,
    brugt,
    rest,
    dageIAlt,
    dageGaaet,
    dageTilbage,
    skalPrDag,
    koererNu,
    forbrugtPct,
    forventetPct,
    afvigelse,
    avg7,
    tomDato,
    tempo: tempoFor(afvigelse, tomDato, to),
  };
}

/** Higher = more critical, for sorting the overview table. */
export function criticalityOf(status: TempoStatus): number {
  return { critical: 4, ahead: 3, behind: 2, on_track: 1, no_data: 0 }[status];
}

// ---------------------------------------------------------------------------
// Forslag til resten af perioden — a heuristic split of `rest` over the days
// left, shaped by payday (higher), the mid-month lull before payday (lower) and
// the last days before Christmas (higher). Amounts are a SUGGESTION to Mathias,
// nothing is written anywhere.
// ---------------------------------------------------------------------------

interface DayWeight {
  weight: number;
  why: string;
}

function weightFor(iso: string, periodTo: string): DayWeight {
  const [yStr, mStr, dStr] = iso.split("-");
  const y = Number(yStr);
  const m0 = Number(mStr) - 1;
  const d = Number(dStr);
  const pay = payday(y, m0);

  // Last days before Christmas (period ends in late December).
  if (m0 === 11 && d >= 20 && iso <= periodTo && periodTo.endsWith("-12-23")) {
    return { weight: 1.25, why: "Sidste dage før jul" };
  }
  // Payday and the few days after — the lift.
  if (iso >= pay && iso <= addDaysIso(pay, 4)) {
    return { weight: 1.35, why: "Lønningsdag – højere budget" };
  }
  // Mid-month lull up to payday.
  if (d >= 15 && iso < pay) {
    return { weight: 0.75, why: "Lav periode op til lønningsdag" };
  }
  return { weight: 1, why: "Normal takt" };
}

export function buildSuggestion(
  calc: BudgetCalc,
  today: string,
): BudgetSuggestion {
  const { from, to, rest } = calc;
  if (!from || !to || rest == null) return { rows: [], total: 0, rest };

  const start = today > from ? today : from;
  if (start > to) return { rows: [], total: 0, rest };

  const days: { date: string; w: DayWeight }[] = [];
  for (let day = start; day <= to; day = addDaysIso(day, 1)) {
    days.push({ date: day, w: weightFor(day, to) });
  }
  const totalWeight = days.reduce((s, x) => s + x.w.weight, 0) || 1;
  const perWeight = rest / totalWeight;

  const rows: BudgetSuggestionRow[] = [];
  let i = 0;
  while (i < days.length) {
    const why = days[i].w.why;
    const from2 = days[i].date;
    let j = i;
    while (j < days.length && days[j].w.why === why) j++;
    const to2 = days[j - 1].date;
    const perDag = Math.round(days[i].w.weight * perWeight);
    const current = today >= from2 && today <= to2;
    rows.push({ from: from2, to: to2, why, perDag, current });
    i = j;
  }

  return { rows, total: rest, rest };
}
