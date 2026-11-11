import { describe, expect, it } from "vitest";
import { buildSuggestion, computeCalc } from "./budget-calc.js";
import type { BudgetPeriod, DailySpendPoint, KoererNu } from "../../shared/budget.js";

const KOERER: KoererNu = { amount: 1000, onAdset: false };

function period(from: string, to: string, budget: number): BudgetPeriod {
  return {
    artistSlug: "x",
    artistLabel: "X",
    label: "p",
    from,
    to,
    periodBudget: budget,
    type: "hoved",
    note: null,
    segments: [{ from, to, fromLabel: "", toLabel: "", days: null, dailyBudget: null, pause: false, note: null }],
    dailySum: null,
  };
}

function flat(from: string, to: string, perDay: number): DailySpendPoint[] {
  const out: DailySpendPoint[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push({ date: new Date(t).toISOString().slice(0, 10), spend: perDay });
  }
  return out;
}

describe("computeCalc (REGNEREGLER)", () => {
  it("on-track when spend pace matches the plan", () => {
    const c = computeCalc(period("2026-11-01", "2026-11-20", 20000), flat("2026-11-01", "2026-11-10", 1000), KOERER, "2026-11-11");
    expect(c.brugt).toBe(10000); // through yesterday (10th)
    expect(c.rest).toBe(10000);
    expect(c.dageIAlt).toBe(20);
    expect(c.dageTilbage).toBe(10);
    expect(c.skalPrDag).toBe(1000);
    expect(c.tempo.status).toBe("on_track");
  });

  it("goes critical (red) when money runs out before the period ends", () => {
    const c = computeCalc(period("2026-11-01", "2026-11-20", 20000), flat("2026-11-01", "2026-11-10", 1800), KOERER, "2026-11-11");
    expect(c.brugt).toBe(18000);
    expect(c.rest).toBe(2000);
    expect(c.tempo.status).toBe("critical");
    expect(c.tempo.text).toContain("tom ");
  });
});

describe("buildSuggestion", () => {
  it("splits the remaining budget into dated rows that total `rest`", () => {
    const c = computeCalc(period("2026-11-01", "2026-11-30", 30000), flat("2026-11-01", "2026-11-10", 1000), KOERER, "2026-11-11");
    const s = buildSuggestion(c, "2026-11-11");
    expect(s.total).toBe(c.rest);
    expect(s.rows.length).toBeGreaterThan(0);
    expect(s.rows.some((r) => r.current)).toBe(true);
  });
});
