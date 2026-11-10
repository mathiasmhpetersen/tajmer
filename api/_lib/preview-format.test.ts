import { describe, expect, it } from "vitest";
import { previewFormatFor } from "./meta.js";

describe("previewFormatFor", () => {
  it("renders a 9:16 aspect as the full Story format", () => {
    expect(previewFormatFor(0.5625).vertical).toBe(true);
  });

  it("renders a 4:5 aspect as the feed format", () => {
    expect(previewFormatFor(0.8).vertical).toBe(false);
  });

  it("treats '1080x1920' in the ad name as 9:16 even when aspect detection misses it", () => {
    // Graph sometimes returns a non-vertical preview image for a genuinely
    // vertical upload; the name carries the source dimensions.
    expect(previewFormatFor(null, "VIDEO | JT_Rullende_Tourplan_1080x1920_091126").vertical).toBe(
      true,
    );
    expect(previewFormatFor(0.8, "IMG | JT_Tour27_Instagram_1080×1920").vertical).toBe(true);
  });

  it("leaves non-1080x1920 names to aspect detection", () => {
    expect(previewFormatFor(null, "IMG | JT_Tour27_Instagram_1080x1350").vertical).toBe(false);
  });
});
