import { describe, expect, it } from "vitest";
import { stripArtistForClient } from "./meta.js";
import type { AdItem, ArtistResponse } from "../../shared/types.js";

function makeAd(): AdItem {
  return {
    adId: "123",
    adName: "VIDEO | Test",
    adsetName: "Bred",
    campaignId: "c1",
    campaignName: "Marketingly: Linda P",
    spend: 441.14,
    impressions: 1200,
    clicks: 60,
    results: 12,
    creativeId: "cr1",
    videoId: "v1",
    imageHash: null,
    preview: {
      iframeSrc: "https://www.facebook.com/plugins/x",
      thumbnailUrl: null,
      isVideo: true,
      body: "hej",
      title: "t",
      ctaType: "SHOP_NOW",
    },
    flags: {},
    adsManagerUrl:
      "https://www.facebook.com/adsmanager/manage/ads/edit?act=1222051031227513&selected_ad_ids=123",
  };
}

const response: ArtistResponse = {
  slug: "linda-p",
  name: "Linda P",
  range: "today",
  totalSpend: 441.14,
  activeAds: 1,
  impressions: 1200,
  clicks: 60,
  results: 12,
  campaigns: [
    { campaignId: "c1", campaignName: "Marketingly: Linda P", displayName: "Linda P", spend: 441.14, ads: [makeAd()] },
  ],
};

describe("stripArtistForClient", () => {
  const stripped = stripArtistForClient(response);
  const json = JSON.stringify(stripped);

  it("contains no Ads Manager link or account id", () => {
    expect(json.toLowerCase()).not.toContain("adsmanager");
    expect(json).not.toContain("act=");
  });

  it("zeroes spend and metrics", () => {
    const ad = stripped.campaigns[0].ads[0];
    expect(stripped.totalSpend).toBe(0);
    expect(ad.spend).toBe(0);
    expect(ad.impressions).toBe(0);
    expect(ad.clicks).toBe(0);
    expect(ad.results).toBeNull();
    expect(ad.adsManagerUrl).toBeUndefined();
  });

  it("keeps the creative preview", () => {
    expect(stripped.campaigns[0].ads[0].preview.iframeSrc).toBeTruthy();
  });
});
