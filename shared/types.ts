// Shared API contract between the React app and the Vercel functions.

/**
 * Two product versions share one codebase. `admin` (Mathias) sees everything;
 * `client` sees only creatives — all spend/performance data is stripped
 * server-side so it never reaches the browser.
 */
export type Role = "admin" | "client";

export interface Session {
  role: Role;
}

export type Range = "today" | "yesterday" | "last_7d";

export const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "I dag" },
  { value: "yesterday", label: "I går" },
  { value: "last_7d", label: "7 dage" },
];

export function isRange(value: unknown): value is Range {
  return value === "today" || value === "yesterday" || value === "last_7d";
}

export interface AdPreview {
  /** Extracted <iframe src> from the Graph `previews` edge, or null if it failed. */
  iframeSrc: string | null;
  /** Large thumbnail (1080×1350 when available) used as poster/fallback. */
  thumbnailUrl: string | null;
  isVideo: boolean;
  body: string | null;
  title: string | null;
  ctaType: string | null;
}

export interface AdFlags {
  /** Same creative appears more than once inside the campaign. */
  duplicate?: boolean;
  /** Primary text mentions a city that isn't in the ad name. */
  checkCopy?: boolean;
  checkCopyCity?: string;
}

export interface AdItem {
  adId: string;
  adName: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number | null;
  creativeId: string | null;
  videoId: string | null;
  imageHash: string | null;
  preview: AdPreview;
  flags: AdFlags;
  adsManagerUrl: string;
}

export interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  /** Campaign name without the "Marketingly: " prefix. */
  displayName: string;
  spend: number;
  ads: AdItem[];
}

export interface ArtistResponse {
  slug: string;
  name: string;
  range: Range;
  totalSpend: number;
  activeAds: number;
  impressions: number;
  clicks: number;
  results: number;
  campaigns: CampaignGroup[];
}

export interface ArtistSummary {
  slug: string;
  name: string;
  activeAds: number;
  spend: number;
  impressions: number;
  /** Up to three creative thumbnails from the top-spending ads. */
  thumbnails: string[];
}

export interface OverviewResponse {
  range: Range;
  totalSpend: number;
  activeAds: number;
  campaignsRunning: number;
  biggestSpender: { slug: string; name: string; spend: number } | null;
  artists: ArtistSummary[];
}

export interface ApiError {
  error: string;
}
