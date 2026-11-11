import { describe, expect, it } from "vitest";
import { parseCsv } from "./budget-csv.js";
import { parsePlan, parseTiltag } from "./budget-plan.js";
import { PLAN_CSV, TILTAG_CSV } from "./budget-data.js";

describe("in-app budget data", () => {
  const { periods, warnings } = parsePlan(parseCsv(PLAN_CSV));

  it("matches every artist (no unknown_artist warnings)", () => {
    expect(warnings.filter((w) => w.code === "unknown_artist")).toHaveLength(0);
    expect(periods.every((p) => p.artistSlug != null)).toBe(true);
  });

  it("carries the authoritative period budgets", () => {
    const budget = (slug: string, label: string) =>
      periods.find((p) => p.artistSlug === slug && p.label === label)?.periodBudget;
    expect(budget("nikolaj-stokholm", "Nov-25/12")).toBe(60000);
    expect(budget("mark-le-fevre", "Okt-10/12")).toBe(27000);
    expect(budget("linda-p", "Nov-25/12")).toBe(100000);
    expect(budget("thomas-warberg", "Okt-25/12")).toBe(75000);
    expect(budget("jakob-thrane", "Sep-25/12")).toBe(100000);
    expect(budget("r8dio", "15/2-30/4")).toBe(60000);
  });

  it("parses the tiltag incl. an 'Alle' event and premiere dates", () => {
    const { events } = parseTiltag(parseCsv(TILTAG_CSV));
    expect(events.find((e) => e.appliesToAll)).toBeTruthy();
    expect(events.some((e) => /premiere/i.test(e.title))).toBe(true);
  });
});
