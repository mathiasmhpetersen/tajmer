import type { BudgetWarningCategory, TempoStatus } from "@shared/budget";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO yyyy-mm-dd → "17/11" (dd/mm). */
export function ddmm(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** ISO yyyy-mm-dd → "17/11/2026". */
export function ddmmyyyy(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** ISO → "17/11" with no leading zeros, e.g. "7/1". */
export function dm(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

const longDateFmt = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long" });
/** ISO → "11. november". */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : longDateFmt.format(d);
}

/** The spec palette, keyed by tempo status. */
export const TEMPO_HEX: Record<TempoStatus, string> = {
  on_track: "#5FA87A", // grøn
  behind: "#D9A441", // gul
  ahead: "#E8833A", // orange
  critical: "#D1604D", // rød
  no_data: "#8E8C88", // grå
};

export const CATEGORY_LABEL: Record<BudgetWarningCategory, string> = {
  forbrug: "Forbrug",
  plan: "Plan",
  periode: "Periode",
  ark: "Ark",
};

export const CATEGORY_HEX: Record<BudgetWarningCategory, string> = {
  forbrug: "#D1604D",
  plan: "#D9A441",
  periode: "#E8833A",
  ark: "#8E8C88",
};

/** Shared spec colours (hex) for the budget section. */
export const BC = {
  bg: "#0A0A0B",
  card: "#141416",
  alarm: "#1A1012",
  border: "rgba(255,255,255,0.08)",
  borderFaint: "rgba(255,255,255,0.05)",
  text: "#F5F4F2",
  textDim: "#B9B7B3",
  textGrey: "#8E8C88",
  textFaint: "#6E6C68",
  futureBar: "#35353A",
  orange: "#E8833A",
  green: "#5FA87A",
  yellow: "#D9A441",
  red: "#D1604D",
} as const;
