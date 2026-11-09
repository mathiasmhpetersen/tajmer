// Maps Meta call_to_action_type enum values to short Danish labels for the
// fallback feed card. Unknown values fall back to a title-cased version.
const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Læs mere",
  SEE_MORE: "Se mere",
  SHOP_NOW: "Køb nu",
  BUY_TICKETS: "Køb billetter",
  BOOK_TRAVEL: "Book nu",
  BOOK_NOW: "Book nu",
  GET_OFFER: "Hent tilbud",
  SIGN_UP: "Tilmeld dig",
  SUBSCRIBE: "Abonnér",
  WATCH_MORE: "Se mere",
  GET_SHOWTIMES: "Se spilletider",
  CONTACT_US: "Kontakt os",
  DOWNLOAD: "Download",
  NO_BUTTON: "",
};

export function ctaLabel(cta: string): string {
  if (cta in CTA_LABELS) return CTA_LABELS[cta];
  return cta
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
