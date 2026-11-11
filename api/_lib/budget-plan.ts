import { artistForName } from "../../shared/artists.js";
import type {
  ArtistShow,
  BudgetAdjustment,
  BudgetEvent,
  BudgetPeriod,
  BudgetSegment,
  BudgetWarning,
  BudgetWarningCategory,
  BudgetWarningCode,
  DailyPlanPoint,
  PaydayMarker,
} from "../../shared/budget.js";

// Pure parsers over raw sheet rows (string[][], row 0 = header). No I/O, so the
// whole Plan/Tiltag layer is unit-tested against committed fixtures. Every data
// problem is surfaced as a BudgetWarning, never silently coerced.

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const MONTHS_DA = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

function nf(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const CATEGORY: Record<BudgetWarningCode, BudgetWarningCategory> = {
  not_configured: "ark",
  sheet_unavailable: "ark",
  unknown_artist: "plan",
  bad_date: "plan",
  pause: "periode",
  note_value: "plan",
  daily_sum_mismatch: "periode",
  template_duplicate: "plan",
  missing_start: "periode",
  overspend: "forbrug",
  missing_data: "ark",
};

export function warn(
  code: BudgetWarningCode,
  message: string,
  extra: Partial<Omit<BudgetWarning, "code" | "category" | "message">> = {},
): BudgetWarning {
  return { code, category: CATEGORY[code], message, ...extra };
}

/** dd/mm/yyyy (or d/m/yy) -> ISO yyyy-mm-dd, or null when unparseable/invalid. */
export function parseDkDate(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let yr = Number(m[3]);
  if (m[3].length === 2) yr += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(yr, mo - 1, d));
  if (dt.getUTCFullYear() !== yr || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Classify a money cell: number / empty / text ("PAUSE", "10000+3000 geo"). */
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

export function isoToUTC(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
export function addDaysIso(iso: string, n: number): string {
  return new Date(isoToUTC(iso) + n * DAY_MS).toISOString().slice(0, 10);
}
export function daysInclusive(fromIso: string, toIso: string): number {
  return Math.round((isoToUTC(toIso) - isoToUTC(fromIso)) / DAY_MS) + 1;
}
function weekdayOf(iso: string): number {
  return new Date(isoToUTC(iso)).getUTCDay(); // 0 = Sunday … 6 = Saturday
}

// ---------------------------------------------------------------------------
// Payday — the 2nd-to-last weekday (Mon–Fri) of a month.
// ---------------------------------------------------------------------------

export function payday(year: number, month0: number): string {
  const last = new Date(Date.UTC(year, month0 + 1, 0)); // last day of month
  let seen = 0;
  for (let d = last.getUTCDate(); d >= 1; d--) {
    const dt = new Date(Date.UTC(year, month0, d));
    const wd = dt.getUTCDay();
    if (wd >= 1 && wd <= 5) {
      seen++;
      if (seen === 2) return dt.toISOString().slice(0, 10);
    }
  }
  return last.toISOString().slice(0, 10);
}

/** Payday markers for every month touched by [from, to]. */
export function paydaysInWindow(fromIso: string, toIso: string): PaydayMarker[] {
  const out: PaydayMarker[] = [];
  const start = new Date(isoToUTC(fromIso));
  const end = new Date(isoToUTC(toIso));
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
    const date = payday(y, m);
    if (date >= fromIso && date <= toIso) out.push({ date, monthLabel: MONTHS_DA[m] });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
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
  const iDaily = col("dagsbudget", "dags");
  const iType = col("type");
  const iPeriode = col("periode");
  const iPeriodBudget = col("periodebudget");
  const iNote = col("note");

  // Group rows by (artist, periode-label) preserving first-seen order.
  const order: string[] = [];
  const groups = new Map<string, BudgetPeriod>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (isEmptyRow(row)) continue;
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const artistLabel = cell(iArtist);
    const fromLabel = cell(iFra);
    const toLabel = cell(iTil);
    const rawDaily = cell(iDaily);
    if (!artistLabel && !fromLabel && !rawDaily) continue;

    const artist = artistForName(artistLabel);
    const slug = artist?.slug ?? null;
    if (artistLabel && !artist) {
      warnings.push(
        warn("unknown_artist", `Ukendt kunstner i Plan: "${artistLabel}"`, {
          values: { artist: artistLabel },
        }),
      );
    }

    const from = fromLabel ? parseDkDate(fromLabel) : null;
    const to = toLabel ? parseDkDate(toLabel) : null;
    if (fromLabel && !from) {
      warnings.push(
        warn("bad_date", `Ugyldig Fra-dato "${fromLabel}" for ${artistLabel || "ukendt"}`, {
          artistSlug: slug,
          values: { fra: fromLabel },
        }),
      );
    }
    if (toLabel && !to) {
      warnings.push(
        warn("bad_date", `Ugyldig Til-dato "${toLabel}" for ${artistLabel || "ukendt"}`, {
          artistSlug: slug,
          values: { til: toLabel },
        }),
      );
    }

    // Segment daily amount.
    let dailyBudget: number | null = null;
    let pause = false;
    let segNote: string | null = cell(iNote) || null;
    if (/pause/i.test(rawDaily)) {
      pause = true;
    } else {
      const db = classifyAmount(rawDaily);
      if (db.kind === "number") dailyBudget = db.value;
      else if (db.kind === "text") {
        segNote = segNote ? `${segNote} · ${rawDaily}` : rawDaily;
        warnings.push(
          warn("note_value", `Dagsbudget er tekst, ikke tal: "${rawDaily}" for ${artistLabel || "ukendt"}`, {
            artistSlug: slug,
            values: { dagsbudget: rawDaily },
          }),
        );
      }
    }

    const segment: BudgetSegment = {
      from,
      to,
      fromLabel,
      toLabel,
      days: from && to ? daysInclusive(from, to) : null,
      dailyBudget,
      pause,
      note: segNote,
    };

    const periodeLabel = cell(iPeriode) || fromLabel || "—";
    const key = `${slug ?? artistLabel.toLowerCase()}::${periodeLabel}`;
    let period = groups.get(key);
    if (!period) {
      period = {
        artistSlug: slug,
        artistLabel,
        label: periodeLabel,
        from: null,
        to: null,
        periodBudget: null,
        type: cell(iType).toLowerCase() || null,
        note: null,
        segments: [],
        dailySum: null,
      };
      groups.set(key, period);
      order.push(key);
    }
    // First non-empty Periodebudget wins (never the sum).
    if (period.periodBudget == null) {
      const pb = classifyAmount(cell(iPeriodBudget));
      if (pb.kind === "number") period.periodBudget = pb.value;
    }
    if (!period.note && cell(iNote)) period.note = cell(iNote);
    if (!period.type && cell(iType)) period.type = cell(iType).toLowerCase();
    period.segments.push(segment);
  }

  const periods = order.map((k) => groups.get(k) as BudgetPeriod);

  // Finalise each period: span, dailySum, mismatch warning.
  for (const p of periods) {
    const dated = p.segments.filter((s) => s.from && s.to);
    if (dated.length) {
      p.from = dated.reduce((min, s) => ((s.from as string) < min ? (s.from as string) : min), dated[0].from as string);
      p.to = dated.reduce((max, s) => ((s.to as string) > max ? (s.to as string) : max), dated[0].to as string);
    }
    let sum = 0;
    let any = false;
    for (const s of p.segments) {
      if (s.dailyBudget != null && s.days != null) {
        sum += s.dailyBudget * s.days;
        any = true;
      }
    }
    p.dailySum = any ? sum : null;

    if (p.periodBudget != null && p.dailySum != null && Math.round(p.dailySum) !== Math.round(p.periodBudget)) {
      warnings.push(
        warn(
          "daily_sum_mismatch",
          `Dagstal summer til ${nf(p.dailySum)} mod ${nf(p.periodBudget)} for ${p.artistLabel} (${p.label})`,
          {
            artistSlug: p.artistSlug,
            detail: `Forskel ${nf(p.dailySum - p.periodBudget)} kr. Kilde: dagsbudget × dage.`,
            values: { periodebudget: p.periodBudget, dagssum: p.dailySum, forskel: p.dailySum - p.periodBudget },
          },
        ),
      );
    }
  }

  warnings.push(...detectTemplateDuplicates(periods));
  return { periods, warnings };
}

export function detectTemplateDuplicates(periods: BudgetPeriod[]): BudgetWarning[] {
  const bySlug = new Map<string, Set<number>>();
  for (const p of periods) {
    if (!p.artistSlug) continue;
    let set = bySlug.get(p.artistSlug);
    if (!set) {
      set = new Set();
      bySlug.set(p.artistSlug, set);
    }
    for (const s of p.segments) if (s.dailyBudget != null) set.add(s.dailyBudget);
  }
  const sigToSlugs = new Map<string, string[]>();
  for (const [slug, set] of bySlug) {
    if (set.size < 2) continue;
    const sig = [...set].sort((a, b) => a - b).map((n) => nf(n)).join(" / ");
    const list = sigToSlugs.get(sig) ?? [];
    list.push(slug);
    sigToSlugs.set(sig, list);
  }
  const out: BudgetWarning[] = [];
  for (const [sig, slugs] of sigToSlugs) {
    if (slugs.length < 2) continue;
    for (const slug of slugs) {
      out.push(
        warn("template_duplicate", `Mistænkt skabelon: dagsbudget-serien ${sig} deles af ${slugs.length} kunstnere.`, {
          artistSlug: slug,
          detail: `Delt mellem ${slugs.join(", ")}.`,
          values: { serie: sig, kunstnere: slugs.join(", ") },
        }),
      );
    }
  }
  return out;
}

/** Day-by-day planned daily budget across the span of the given periods. */
export function buildDailyPlan(periods: BudgetPeriod[]): DailyPlanPoint[] {
  const segs = periods.flatMap((p) => p.segments).filter((s) => s.from && s.to);
  if (segs.length === 0) return [];
  let min = segs[0].from as string;
  let max = segs[0].to as string;
  for (const s of segs) {
    if ((s.from as string) < min) min = s.from as string;
    if ((s.to as string) > max) max = s.to as string;
  }
  const out: DailyPlanPoint[] = [];
  for (let day = min; day <= max; day = addDaysIso(day, 1)) {
    let planned: number | null = null;
    let pause = false;
    let covered = false;
    for (const s of segs) {
      if (day >= (s.from as string) && day <= (s.to as string)) {
        covered = true;
        pause = s.pause;
        planned = s.pause ? null : s.dailyBudget;
      }
    }
    out.push({ date: day, planned: covered ? planned : null, pause });
  }
  return out;
}

/** Dates where the daily budget changes, chronological. */
export function deriveAdjustments(periods: BudgetPeriod[]): BudgetAdjustment[] {
  const segs = periods
    .flatMap((p) => p.segments.map((s) => ({ s, slug: p.artistSlug })))
    .filter((x) => x.s.from)
    .sort((a, b) => ((a.s.from as string) < (b.s.from as string) ? -1 : 1));
  const out: BudgetAdjustment[] = [];
  let prev: number | null = null;
  let hasPrev = false;
  for (const { s, slug } of segs) {
    const cur = s.pause ? null : s.dailyBudget;
    if (hasPrev && cur !== prev) {
      out.push({
        artistSlug: slug,
        date: s.from,
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
  søndag: 0, sondag: 0, mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6, lordag: 6,
};

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
    if (wd === undefined || !n) return { dates: [fromIso], note: `Ukendt gentagelse: "${recurrence}"` };
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
  const iType = col("type");
  const iTitel = col("titel");
  const iHandling = col("handling");
  const iKilde = col("kilde");
  const iStatus = col("status");

  const events: BudgetEvent[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (isEmptyRow(row)) continue;
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const artistLabel = cell(iArtist);
    const title = cell(iTitel);
    if (!artistLabel && !title) continue;

    const appliesToAll = /^alle$/i.test(artistLabel);
    const artist = appliesToAll ? undefined : artistForName(artistLabel);
    const slug = appliesToAll ? null : artist?.slug ?? null;
    if (artistLabel && !appliesToAll && !artist) {
      warnings.push(
        warn("unknown_artist", `Ukendt kunstner i Tiltag: "${artistLabel}"`, {
          values: { artist: artistLabel },
        }),
      );
    }

    const fromLabel = cell(iFra);
    const toLabel = cell(iTil);
    const from = fromLabel ? parseDkDate(fromLabel) : null;
    const to = toLabel ? parseDkDate(toLabel) : null;
    if (fromLabel && !from) {
      warnings.push(
        warn("bad_date", `Ugyldig Fra-dato "${fromLabel}" i Tiltag for ${artistLabel || "ukendt"}`, {
          artistSlug: slug,
          values: { fra: fromLabel },
        }),
      );
    }

    const recurrence = cell(iGent);
    const { dates, note } = expandRecurrence(from, to, recurrence);
    if (note) warnings.push(warn("note_value", note, { artistSlug: slug, values: { gentagelse: recurrence } }));

    events.push({
      artistSlug: slug,
      appliesToAll,
      artistLabel,
      from,
      to,
      fromLabel,
      toLabel,
      title,
      source: cell(iKilde) || null,
      recurrence,
      occurrences: dates,
      type: cell(iType) || null,
      handling: cell(iHandling) || null,
      status: cell(iStatus) || null,
    });
  }

  return { events, warnings };
}

/** Show name + premiere date for an artist, from "Premiere …" Tiltag events. */
export function artistShowFromEvents(events: BudgetEvent[], slug: string): ArtistShow {
  const premiere = events.find(
    (e) => e.artistSlug === slug && /premiere/i.test(e.title),
  );
  if (!premiere) return { show: null, premiere: null };
  const show = premiere.title.replace(/^.*?premiere\s*[-–—:]\s*/i, "").trim() || null;
  return { show, premiere: premiere.from ?? premiere.occurrences[0] ?? null };
}
