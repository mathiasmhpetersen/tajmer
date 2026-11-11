import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./budget-csv.js";
import {
  artistShowFromEvents,
  classifyAmount,
  parseDkDate,
  parsePlan,
  parseTiltag,
  payday,
} from "./budget-plan.js";
import type { BudgetWarningCode } from "../../shared/budget.js";

const planRows = parseCsv(readFileSync(new URL("./__fixtures__/plan.sample.csv", import.meta.url), "utf8"));
const tiltagRows = parseCsv(readFileSync(new URL("./__fixtures__/tiltag.sample.csv", import.meta.url), "utf8"));

function codes(ws: { code: BudgetWarningCode }[]): Set<BudgetWarningCode> {
  return new Set(ws.map((w) => w.code));
}

describe("parseDkDate / classifyAmount", () => {
  it("parses dates and amounts, rejecting junk", () => {
    expect(parseDkDate("17/11/2026")).toBe("2026-11-17");
    expect(parseDkDate("31/02/2026")).toBeNull();
    expect(classifyAmount("100000")).toEqual({ value: 100000, kind: "number" });
    expect(classifyAmount("")).toEqual({ value: null, kind: "empty" });
    expect(classifyAmount("PAUSE")).toEqual({ value: null, kind: "text" });
  });
});

describe("payday (2nd-to-last weekday)", () => {
  it("is Fri 27 Nov 2026 and Wed 30 Dec 2026", () => {
    expect(payday(2026, 10)).toBe("2026-11-27");
    expect(payday(2026, 11)).toBe("2026-12-30");
  });
});

describe("parsePlan — period grouping", () => {
  const { periods, warnings } = parsePlan(planRows);

  it("groups rows by (Artist, Periode) into one period with several segments", () => {
    const nk = periods.filter((p) => p.artistSlug === "nikolaj-stokholm");
    expect(nk).toHaveLength(1);
    expect(nk[0].label).toBe("17/11-23/12");
    expect(nk[0].segments).toHaveLength(2);
  });

  it("takes the FIRST Periodebudget per period, never the sum", () => {
    const nk = periods.find((p) => p.artistSlug === "nikolaj-stokholm");
    expect(nk?.periodBudget).toBe(75000);
    const linda = periods.find((p) => p.artistSlug === "linda-p");
    expect(linda?.periodBudget).toBe(100000);
  });

  it("computes the day-sum and flags it against the periodebudget", () => {
    const linda = periods.find((p) => p.artistSlug === "linda-p");
    // 1000×14 + 2000×39 = 92.000 vs 100.000.
    expect(linda?.dailySum).toBe(92000);
    expect(codes(warnings)).toContain("daily_sum_mismatch");
  });

  it("flags a day-series shared across artists (Linda P and Nikolaj both 1000/2000)", () => {
    const dup = warnings.filter((w) => w.code === "template_duplicate");
    const slugs = new Set(dup.map((w) => w.artistSlug));
    expect(slugs).toContain("linda-p");
    expect(slugs).toContain("nikolaj-stokholm");
  });

  it("spans each period from the earliest segment start to the latest end", () => {
    const linda = periods.find((p) => p.artistSlug === "linda-p");
    expect(linda?.from).toBe("2026-11-01");
    expect(linda?.to).toBe("2026-12-23");
  });
});

describe("parseTiltag", () => {
  const { events } = parseTiltag(tiltagRows);

  it('treats "Alle" as applying to every artist', () => {
    const all = events.find((e) => e.title.startsWith("Julekampagne"));
    expect(all?.appliesToAll).toBe(true);
    expect(all?.artistSlug).toBeNull();
  });

  it("derives show + premiere from a Premiere event", () => {
    const show = artistShowFromEvents(events, "linda-p");
    expect(show.premiere).toBe("2027-01-14");
    expect(show.show).toBe("Stand-up Tour 2027");
  });
});
