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
  /** Native iframe size to render at (feed = 400×640, vertical Story = 360×640). */
  previewWidth: number;
  previewHeight: number;
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
  /** Admin only — omitted from client responses (contains the account id). */
  adsManagerUrl?: string;
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

// ---------------------------------------------------------------------------
// Preview / approval feature
// ---------------------------------------------------------------------------

/** afventer = awaiting approval, godkendt = approved, rettelser = corrections requested. */
export type PreviewStatus = "afventer" | "godkendt" | "rettelser";

export const PREVIEW_STATUS_LABEL: Record<PreviewStatus, string> = {
  afventer: "Afventer godkendelse",
  godkendt: "Godkendt",
  rettelser: "Rettelser ønsket",
};

/** Which creative field a correction targets. */
export type CorrectionField = "headline" | "primary_text" | "description" | "other";
/** How the new text is applied (not used for "other"). */
export type CorrectionMethod = "replace" | "append" | "prepend";

export const CORRECTION_FIELD_LABEL: Record<CorrectionField, string> = {
  headline: "Overskrift",
  primary_text: "Primær tekst",
  description: "Beskrivelse",
  other: "Andet",
};

export const CORRECTION_METHOD_LABEL: Record<CorrectionMethod, string> = {
  replace: "Skift til",
  append: "Tilføj i slutningen",
  prepend: "Tilføj i starten",
};

export interface PreviewFeedbackItem {
  id: string;
  text: string;
  role: Role;
  createdAt: string;
  resolved: boolean;
  resolvedBy?: Role;
  resolvedAt?: string;
  /** Optional note from Marketingly shown to the client when resolved. */
  resolvedNote?: string;
  /** New ad id this correction was fixed with (links to the replacement ad). */
  fixedAdId?: string;
  /** Set when this correction is part of a bulk ("Samlet rettelse") batch. */
  batchId?: string;
  field?: CorrectionField;
  method?: CorrectionMethod;
}

export interface CorrectionBatch {
  batchId: string;
  createdAt: string;
  role: Role;
  artistSlug: string;
  field: CorrectionField;
  method: CorrectionMethod;
  text: string;
  adIds: string[];
  creativeIds: (string | null)[];
}

export interface PreviewAd {
  adId: string;
  adName: string;
  creativeId: string | null;
  effectiveStatus: string;
  adsetName: string;
  startTime: string | null;
  endTime: string | null;
  campaignId: string;
  campaignName: string;
  displayName: string;
  preview: {
    iframeSrc: string | null;
    previewWidth: number;
    previewHeight: number;
    thumbnailUrl: string | null;
    isVideo: boolean;
    body: string | null;
    title: string | null;
    description: string | null;
    ctaType: string | null;
  };
  status: PreviewStatus;
  approvedBy?: Role;
  approvedAt?: string;
  feedback: PreviewFeedbackItem[];
  /** Admin only. */
  adsManagerUrl?: string;
}

export interface PreviewCampaignGroup {
  campaignId: string;
  displayName: string;
  ads: PreviewAd[];
}

export interface PreviewArtistGroup {
  slug: string;
  name: string;
  /** Ads in this block that are not yet godkendt. */
  pendingCount: number;
  campaigns: PreviewCampaignGroup[];
}

export interface PreviewResponse {
  role: Role;
  artists: PreviewArtistGroup[];
}

/** One ad reference used by the bulk approve endpoint. */
export interface ApproveItem {
  adId: string;
  creativeId: string | null;
}
