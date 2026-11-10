import { artistForName } from "../../shared/artists.js";
import type {
  BudgetAdjustment,
  BudgetEvent,
  BudgetPeriod,
  BudgetWarning,
  DailyPlanPoint,
} from "../../shared/budget.js";

// Pure parsers over raw sheet rows (string[][], row 0 = header). No I/O here, so
// the whole Plan/Tiltag layer is unit-tested against committed fixtures. Every
// data problem is surfaced as a BudgetWarning rather than silently coerced.

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Danish integer formatting for warning messages (1.245). */
function nf(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** dd/mm/yyyy (or d/m/yy) -> ISO yyyy-mm-dd, or null when unparseable/invalid. */
export function parseDkDate(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (m[3].length === 2) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null; // e.g. 31/02/2026
  }
  return dt.toISOString().slice(0, 10);
}

/**
 * Classify a money cell. Danish format: '.' thousands, ',' decimals. Returns a
 * number when it's plainly numeric, "empty" for blanks, and "text" for anything
 * else ("PAUSE", "10000+3000 geo") so the caller can keep it as a note, never 0.
 */
export function classifyAmount(raw: string): {
  value: number | null;
  kind: "number" | "empty" | "text";
} {
  const s = raw.trim();
  if (!s) return { value: null, kind: "empty" };
  const cleaned = s.replace(/kr\.?$/i, "").trim();
  if (/^-?[\d.\s]+(,\d+)?$/.test(cleaned)) {
    const n = Number(cleaned.replace(/[.\s]/g, "").replace(",", "."));
    if (Number.isFinite(n)) return { value: n, kind: "number" };
  }
  return { value: null, kind: "text" };
}

const DAY_MS = 86_400_000;
function isoToUTC(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
function addDaysIso(iso: string, n: number): string {
  return new Date(isoToUTC(iso) + n * DAY_MS).toISOString().slice(0, 10);
}
function daysInclusive(fromIso: string, toIso: string): number {
  return Math.round((isoToUTC(toIso) - isoToUTC(fromIso)) / DAY_MS) + 1;
}
function weekdayOf(iso: string): number {
  return new Date(isoToUTC(iso)).getUTCDay(); // 0 = Sunday … 6 = Saturday
}

// ---------------------------------------------------------------------------
// Header mapping (tolerant to column order / minor label changes)
// ---------------------------------------------------------------------------

function headerFinder(header: string[]): (...keys: string[]) => number {
  const norm = header.map((h) => h.trim().toLowerCase());
  return (...keys: string[]) => {
    for (const k of keys) {
      const exact = norm.indexOf(k);
      if (exact !== -1) return exact;
    }
    for (const k of keys) {
      const partial = norm.findIndex((h) => h.includes(k));
      if (partial !== -1) return partial;
    }
    return -1;
  };
}

function isEmptyRow(row: string[] | undefined): boolean {
  return !row || row.every((c) => !c || !c.trim());
}

// ---------------------------------------------------------------------------
// Plan tab
// ---------------------------------------------------------------------------

export function parsePlan(rows: string[][]): {
  periods: BudgetPeriod[];
  warnings: BudgetWarning[];
} {
  const warnings: BudgetWarning[] = [];
  if (rows.length === 0) return { periods: [], warnings };

  const col = headerFinder(rows[0]);
  const iArtist = col("artist");
  const iFra = col("fra");
  const iTil = col("til");
  const iPB = col("periodebudget", "periode");
  const iDB = col("dagsbudget", "dags");
  const iType = col("type");
  const iNote = col("note");

  const periods: BudgetPeriod[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (isEmptyRow(row)) continue;
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const artistLabel = cell(iArtist);
    const fromLabel = cell(iFra);
    const toLabel = cell(iTil);
    const rawPB = cell(iPB);
    const rawDB = cell(iDB);
    if (!artistLabel && !fromLabel && !rawDB && !rawPB) continue;

    const artist = artistForName(artistLabel);
    const slug = artist?.slug ?? null;
    if (artistLabel && !artist) {
      warnings.push({
        code: "unknown_artist",
        message: `Ukendt kunstner i Plan: "${artistLabel}"`,
        values: { artist: artistLabel },
      });
    }

    const from = fromLabel ? parseDkDate(fromLabel) : null;
    const to = toLabel ? parseDkDate(toLabel) : null;
    if (fromLabel && !from) {
      warnings.push({
        code: "bad_date",
        artistSlug: slug,
        message: `Ugyldig Fra-dato "${fromLabel}" for ${artistLabel || "ukendt"}`,
        values: { fra: fromLabel },
      });
    }
    if (toLabel && !to) {
      warnings.push({
        code: "bad_date",
        artistSlug: slug,
        message: `Ugyldig Til-dato "${toLabel}" for ${artistLabel || "ukendt"}`,
        values: { til: toLabel },
      });
    }

    const periodBudget = classifyAmount(rawPB).value;

    let dailyBudget: number | null = null;
    let pause = false;
    let note: string | null = cell(iNote) || null;

    if (/pause/i.test(rawDB) || /pause/i.test(note ?? "")) {
      pause = true;
      warnings.push({
        code: "pause",
        artistSlug: slug,
        period: { from, to },
        message: `PAUSE-periode for ${artistLabel || "ukendt"} (${fromLabel || "?"}–${toLabel || "?"})`,
      });
    } else {
      const db = classifyAmount(rawDB);
      if (db.kind === "number") {
        dailyBudget = db.value;
      } else if (db.kind === "text") {
        note = note ? `${note} · ${rawDB}` : rawDB;
        warnings.push({
          code: "note_value",
          artistSlug: slug,
          period: { from, to },
          message: `Dagsbudget er tekst, ikke tal: "${rawDB}" for ${artistLabel || "ukendt"}`,
          values: { dagsbudget: rawDB },
        });
      }
    }

    const days = from && to ? daysInclusive(from, to) : null;
    const dailySum = dailyBudget != null && days != null ? dailyBudget * days : null;
    const type = cell(iType).toLowerCase() || null;

    periods.push({
      artistSlug: slug,
      artistLabel,
      from,
      to,
      fromLabel,
      toLabel,
      days,
      periodBudget,
      dailyBudget,
      dailySum,
      type,
      note,
      pause,
      rawPeriodBudget: rawPB,
      rawDailyBudget: rawDB,
    });

    if (periodBudget != null && dailySum != null && Math.round(dailySum) !== Math.round(periodBudget)) {
      warnings.push({
        code: "daily_sum_mismatch",
        artistSlug: slug,
        period: { from, to },
        message:
          `Dagsum ${nf(dailySum)} ≠ periodebudget ${nf(periodBudget)} ` +
          `(forskel ${nf(dailySum - periodBudget)}) for ${artistLabel || "ukendt"}`,
        values: {
          periodebudget: periodBudget,
          dagssum: dailySum,
          forskel: dailySum - periodBudget,
          kilde_dagssum: `${dailyBudget} kr × ${days} dage`,
        },
      });
    }
  }

  warnings.push(...detectTemplateDuplicates(periods));
  return { periods, warnings };
}

/**
 * Flag identical day-budget series shared across artists ("mistænkt skabelon" —
 * the 1.245 / 1.533 / 1.916 block copy-pasted between Warberg, Thrane, r8Dio and
 * Stokholm). Signatures of a single value are ignored to avoid noise.
 */
export function detectTemplateDuplicates(periods: BudgetPeriod[]): BudgetWarning[] {
  const bySlug = new Map<string, Set<number>>();
  for (const p of periods) {
    if (!p.artistSlug || p.dailyBudget == null) continue;
    let set = bySlug.get(p.artistSlug);
    if (!set) {
      set = new Set();
      bySlug.set(p.artistSlug, set);
    }
    set.add(p.dailyBudget);
  }
  const sigToSlugs = new Map<string, string[]>();
  for (const [slug, set] of bySlug) {
    if (set.size < 2) continue;
    const sig = [...set].sort((a, b) => a - b).map((n) => nf(n)).join(" / ");
    const list = sigToSlugs.get(sig) ?? [];
    list.push(slug);
    sigToSlugs.set(sig, list);
  }
  const warnings: BudgetWarning[] = [];
  for (const [sig, slugs] of sigToSlugs) {
    if (slugs.length < 2) continue;
    for (const slug of slugs) {
      warnings.push({
        code: "template_duplicate",
        artistSlug: slug,
        message: `Mistænkt skabelon: dagsbudget-serien ${sig} deles af ${slugs.length} kunstnere (${slugs.join(", ")}).`,
        values: { serie: sig, kunstnere: slugs.join(", ") },
      });
    }
  }
  return warnings;
}

/** Day-by-day planned budget across the span of the given periods (steps). */
export function buildDailyPlan(periods: BudgetPeriod[]): DailyPlanPoint[] {
  const dated = periods.filter((p) => p.from && p.to);
  if (dated.length === 0) return [];
  let min = dated[0].from as string;
  let max = dated[0].to as string;
  for (const p of dated) {
    if ((p.from as string) < min) min = p.from as string;
    if ((p.to as string) > max) max = p.to as string;
  }
  const out: DailyPlanPoint[] = [];
  for (let day = min; day <= max; day = addDaysIso(day, 1)) {
    // Last matching period wins when ranges overlap.
    let planned: number | null = null;
    let pause = false;
    let covered = false;
    for (const p of dated) {
      if (day >= (p.from as string) && day <= (p.to as string)) {
        covered = true;
        pause = p.pause;
        planned = p.pause ? null : p.dailyBudget;
      }
    }
    out.push({ date: day, planned: covered ? planned : null, pause });
  }
  return out;
}

/** Dates where the daily budget should change, in chronological order. */
export function deriveAdjustments(periods: BudgetPeriod[]): BudgetAdjustment[] {
  const sorted = periods
    .filter((p) => p.from)
    .slice()
    .sort((a, b) => ((a.from as string) < (b.from as string) ? -1 : 1));
  const out: BudgetAdjustment[] = [];
  let prev: number | null = null;
  let hasPrev = false;
  for (const p of sorted) {
    const cur = p.pause ? null : p.dailyBudget;
    if (hasPrev && cur !== prev) {
      out.push({
        artistSlug: p.artistSlug,
        date: p.from,
        fromDaily: prev,
        toDaily: cur,
        direction: cur == null || prev == null ? "none" : cur > prev ? "up" : cur < prev ? "down" : "none",
      });
    }
    prev = cur;
    hasPrev = true;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tiltag tab (events / markers)
// ---------------------------------------------------------------------------

const DK_WEEKDAYS: Record<string, number> = {
  søndag: 0,
  sondag: 0,
  mandag: 1,
  tirsdag: 2,
  onsdag: 3,
  torsdag: 4,
  fredag: 5,
  lørdag: 6,
  lordag: 6,
};

/** Expand a "Gentagelse" into the ISO dates the marker should appear on. */
export function expandRecurrence(
  fromIso: string | null,
  _toIso: string | null,
  recurrence: string,
): { dates: string[]; note?: string } {
  if (!fromIso) return { dates: [] };
  const r = recurrence.trim().toLowerCase();
  if (!r || r === "ingen") return { dates: [fromIso] };

  const m = r.match(/hver\s+([a-zæøå]+)\s+i\s+(\d+)\s+uger?/);
  if (m) {
    const wd = DK_WEEKDAYS[m[1]];
    const n = Number(m[2]);
    if (wd === undefined || !n) {
      return { dates: [fromIso], note: `Ukendt gentagelse: "${recurrence}"` };
    }
    let start = fromIso;
    for (let i = 0; i < 7 && weekdayOf(start) !== wd; i++) start = addDaysIso(start, 1);
    const dates: string[] = [];
    for (let i = 0; i < n; i++) dates.push(addDaysIso(start, i * 7));
    return { dates };
  }
  return { dates: [fromIso], note: `Ukendt gentagelse: "${recurrence}"` };
}

export function parseTiltag(rows: string[][]): {
  events: BudgetEvent[];
  warnings: BudgetWarning[];
} {
  const warnings: BudgetWarning[] = [];
  if (rows.length === 0) return { events: [], warnings };

  const col = headerFinder(rows[0]);
  const iArtist = col("artist");
  const iFra = col("fra");
  const iTil = col("til");
  const iGent = col("gentagelse", "gentag");
  const iTitel = col("titel", "titel");
  const iKilde = col("kilde");

  const events: BudgetEvent[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (isEmptyRow(row)) continue;
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const artistLabel = cell(iArtist);
    const title = cell(iTitel);
    if (!artistLabel && !title) continue;

    const artist = artistForName(artistLabel);
    const slug = artist?.slug ?? null;
    if (artistLabel && !artist) {
      warnings.push({
        code: "unknown_artist",
        message: `Ukendt kunstner i Tiltag: "${artistLabel}"`,
        values: { artist: artistLabel },
      });
    }

    const fromLabel = cell(iFra);
    const toLabel = cell(iTil);
    const from = fromLabel ? parseDkDate(fromLabel) : null;
    const to = toLabel ? parseDkDate(toLabel) : null;
    if (fromLabel && !from) {
      warnings.push({
        code: "bad_date",
        artistSlug: slug,
        message: `Ugyldig Fra-dato "${fromLabel}" i Tiltag for ${artistLabel || "ukendt"}`,
        values: { fra: fromLabel },
      });
    }

    const recurrence = cell(iGent);
    const { dates, note } = expandRecurrence(from, to, recurrence);
    if (note) {
      warnings.push({
        code: "note_value",
        artistSlug: slug,
        message: note,
        values: { gentagelse: recurrence },
      });
    }

    events.push({
      artistSlug: slug,
      artistLabel,
      from,
      to,
      fromLabel,
      toLabel,
      title,
      source: cell(iKilde) || null,
      recurrence,
      occurrences: dates,
    });
  }

  return { events, warnings };
}
