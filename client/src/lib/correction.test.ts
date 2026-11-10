import { describe, expect, it } from "vitest";
import { applyCorrection, currentFieldValue } from "./correction";
import type { PreviewAd } from "@shared/types";

const ad = {
  preview: { title: "Gammel overskrift", body: "Primær", description: "Beskr" },
} as PreviewAd;

describe("currentFieldValue", () => {
  it("reads the right field", () => {
    expect(currentFieldValue(ad, "headline")).toBe("Gammel overskrift");
    expect(currentFieldValue(ad, "primary_text")).toBe("Primær");
    expect(currentFieldValue(ad, "description")).toBe("Beskr");
    expect(currentFieldValue(ad, "other")).toBe("");
  });
});

describe("applyCorrection", () => {
  it("replace / append / prepend", () => {
    expect(applyCorrection("abc", "replace", "xyz")).toBe("xyz");
    expect(applyCorrection("abc", "append", "xyz")).toBe("abc xyz");
    expect(applyCorrection("abc", "prepend", "xyz")).toBe("xyz abc");
    expect(applyCorrection("", "append", "xyz")).toBe("xyz");
  });
});
