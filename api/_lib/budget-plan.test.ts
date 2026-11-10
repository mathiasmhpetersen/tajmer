import { describe, expect, it } from "vitest";
import {
  buildDailyPlan,
  classifyAmount,
  deriveAdjustments,
  parseDkDate,
  parsePlan,
  parseTiltag,
} from "./budget-plan.js";
import { PLAN_FIXTURE, TILTAG_FIXTURE } from "./budget-plan.fixture.js";
import type { BudgetWarningCode } from "../../shared/budget.js";

function codes(ws: { code: BudgetWarningCode }[]): Set<BudgetWarningCode> {
  return new Set(ws.map((w) => w.code));
}

describe("parseDkDate", () => {
  it("parses dd/mm/yyyy to ISO", () => {
    expect(parseDkDate("17/11/2025")).toBe("2025-11-17");
    expect(parseDkDate("1/1/26")).toBe("2026-01-01");
  });
  it("rejects invalid or malformed dates", () => {
    expect(parseDkDate("31/02/2026")).toBeNull();
    expect(parseDkDate("ikke en dato")).toBeNull();
    expect(parseDkDate("")).toBeNull();
  });
});

describe("classifyAmount", () => {
  it("reads Danish-formatted numbers", () => {
    expect(classifyAmount("1.245")).toEqual({ value: 1245, kind: "number" });
    expect(classifyAmount("50.000")).toEqual({ value: 50000, kind: "number" });
    expect(classifyAmount("1.245,50")).toEqual({ value: 1245.5, kind: "number" });
  });
  it("treats blanks as empty and text as text (never 0)", () => {
    expect(classifyAmount("")).toEqual({ value: null, kind: "empty" });
    expect(classifyAmount("PAUSE")).toEqual({ value: null, kind: "text" });
    expect(classifyAmount("10000+3000 geo")).toEqual({ value: null, kind: "text" });
  });
});

describe("parsePlan", () => {
  const { periods, warnings } = parsePlan(PLAN_FIXTURE);

  it("skips blank rows and parses every data row", () => {
    // 3 Warberg + 3 Thrane + 4 Stokholm + 1 unknown = 11 periods.
    expect(periods).toHaveLength(11);
  });

  it("surfaces every data problem as a warning", () => {
    const present = codes(warnings);
    for (const code of [
      "daily_sum_mismatch",
      "pause",
      "note_value",
      "bad_date",
      "unknown_artist",
      "template_duplicate",
    ] as const) {
      expect(present).toContain(code);
    }
  });

  it("flags the copy-pasted day-series across both artists", () => {
    const dup = warnings.filter((w) => w.code === "template_duplicate");
    const slugs = new Set(dup.map((w) => w.artistSlug));
    expect(slugs).toContain("thomas-warberg");
    expect(slugs).toContain("jakob-thrane");
  });

  it("keeps PAUSE as pause with no daily amount", () => {
    const pause = periods.find((p) => p.pause);
    expect(pause?.dailyBudget).toBeNull();
    expect(pause?.artistSlug).toBe("nikolaj-stokholm");
  });

  it("keeps a text amount as a note, not 0", () => {
    const note = periods.find((p) => p.rawDailyBudget === "10000+3000 geo");
    expect(note?.dailyBudget).toBeNull();
    expect(note?.note).toContain("10000+3000 geo");
  });

  it("reports the daily-sum vs periodebudget mismatch with both values", () => {
    const mismatch = warnings.find((w) => w.code === "daily_sum_mismatch");
    expect(mismatch?.values?.periodebudget).toBe(50000);
    expect(mismatch?.values?.dagssum).toBe(51652);
  });
});

describe("deriveAdjustments", () => {
  it("emits an upward adjustment at each daily change", () => {
    const warberg = parsePlan(PLAN_FIXTURE).periods.filter((p) => p.artistSlug === "thomas-warberg");
    const adj = deriveAdjustments(warberg);
    expect(adj).toHaveLength(2);
    expect(adj.every((a) => a.direction === "up")).toBe(true);
    expect(adj[0]).toMatchObject({ date: "2025-11-08", fromDaily: 1245, toDaily: 1533 });
  });
});

describe("buildDailyPlan", () => {
  it("expands periods to one point per day across the whole span", () => {
    const warberg = parsePlan(PLAN_FIXTURE).periods.filter((p) => p.artistSlug === "thomas-warberg");
    const plan = buildDailyPlan(warberg);
    expect(plan).toHaveLength(21); // 01/11 – 21/11 inclusive
    expect(plan[0]).toEqual({ date: "2025-11-01", planned: 1245, pause: false });
    expect(plan.at(-1)).toEqual({ date: "2025-11-21", planned: 1916, pause: false });
  });
});

describe("parseTiltag", () => {
  const { events, warnings } = parseTiltag(TILTAG_FIXTURE);

  it("parses one event per data row", () => {
    expect(events).toHaveLength(4);
  });

  it('expands "ingen" to a single marker', () => {
    const tv = events.find((e) => e.title === "TV 2 interview");
    expect(tv?.occurrences).toEqual(["2025-11-01"]);
  });

  it('expands "hver <ugedag> i N uger" to N weekly markers', () => {
    const radio = events.find((e) => e.title === "Radioklip");
    expect(radio?.occurrences).toHaveLength(4);
    // every marker is the same weekday, 7 days apart.
    const podcast = events.find((e) => e.title === "Podcast");
    expect(podcast?.occurrences).toHaveLength(3);
  });

  it("warns on an unrecognised recurrence but still places one marker", () => {
    expect(codes(warnings)).toContain("note_value");
    const unknown = events.find((e) => e.title === "Noget");
    expect(unknown?.occurrences).toHaveLength(1);
  });
});
