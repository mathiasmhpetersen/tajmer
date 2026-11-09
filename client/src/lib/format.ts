const dkkFormatter = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dkkWholeFormatter = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "44,14 kr." — da-DK currency, Meta spend has øre precision. */
export function formatMoney(value: number): string {
  return dkkFormatter.format(value).replace("kr.", "kr.");
}

/** "6.167 kr." — rounded, for big KPI headline numbers. */
export function formatMoneyWhole(value: number): string {
  return dkkWholeFormatter.format(Math.round(value));
}

const numberFormatter = new Intl.NumberFormat("da-DK");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** 1200 → "1,2k", 980 → "980". Compact impressions etc. */
export function formatCompact(value: number): string {
  if (value < 1000) return formatNumber(value);
  const k = value / 1000;
  const str = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(".", ",");
  return `${str}k`;
}

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "Mandag 9. november" with an uppercased first letter. */
export function formatToday(date = new Date()): string {
  const s = dateFormatter.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
