import { describe, expect, it } from "vitest";
import { previewFormatFor } from "./meta.js";

describe("previewFormatFor", () => {
  it("renders every ad — including 9:16 — as the standard feed preview", () => {
    const f = previewFormatFor();
    expect(f.vertical).toBe(false);
    expect(f.format).toBe("MOBILE_FEED_STANDARD");
  });
});
