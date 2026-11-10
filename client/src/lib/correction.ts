import type { CorrectionField, CorrectionMethod, PreviewAd } from "@shared/types";

/** The ad's current value for the chosen field (empty string when absent). */
export function currentFieldValue(ad: PreviewAd, field: CorrectionField): string {
  switch (field) {
    case "headline":
      return ad.preview.title ?? "";
    case "primary_text":
      return ad.preview.body ?? "";
    case "description":
      return ad.preview.description ?? "";
    default:
      return "";
  }
}

/** Preview of the field value after the correction is applied. */
export function applyCorrection(
  current: string,
  method: CorrectionMethod,
  text: string,
): string {
  if (method === "append") return current ? `${current} ${text}` : text;
  if (method === "prepend") return current ? `${text} ${current}` : text;
  return text;
}
