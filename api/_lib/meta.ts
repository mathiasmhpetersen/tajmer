import {
  ARTISTS,
  ARTISTS_BY_SLUG,
  artistForCampaign,
  campaignMatchesArtist,
  type Artist,
} from "../../shared/artists.js";
import type {
  AdItem,
  ArtistResponse,
  ArtistSummary,
  CampaignGroup,
  OverviewResponse,
  PreviewAd,
  PreviewArtistGroup,
  PreviewCampaignGroup,
  PreviewResponse,
  PreviewStatus,
  Range,
  Role,
} from "../../shared/types.js";
import { MetaError, requireEnv } from "./http.js";
import { readState } from "./kv.js";
import { fetchImageAspect } from "./imagesize.js";
import { DK_CITIES } from "./cities.js";

const PREVIEW_CONCURRENCY = 8;

// A 9:16 video is masked to ~4:5 in the feed preview, so for truly vertical
// media we render the Story preview instead — it shows the full frame.
const PORTRAIT_MAX_ASPECT = 0.7; // w/h below this is vertical (9:16 = 0.56)
const FEED_FORMAT = "MOBILE_FEED_STANDARD";
const STORY_FORMAT = "FACEBOOK_STORY_MOBILE";
// Native iframe sizes we render at (then scale down to the card). The feed card
// needs 400px wide to show the whole card; the Story is a clean 9:16.
const FEED_SIZE = { width: 400, height: 640 };
const STORY_SIZE = { width: 360, height: 640 };

function mediaImageUrlOf(c: RawCreative): string | null {
  return (
    c.object_story_spec?.video_data?.image_url ??
    c.object_story_spec?.link_data?.picture ??
    c.image_url ??
    c.thumbnail_url ??
    null
  );
}

function version(): string {
  return process.env.META_API_VERSION || "v21.0";
}

function account(): string {
  const id = requireEnv("META_AD_ACCOUNT_ID").replace(/^act_/, "");
  return `act_${id}`;
}

function accountNumeric(): string {
  return requireEnv("META_AD_ACCOUNT_ID").replace(/^act_/, "");
}

interface GraphPage<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string; error_user_msg?: string };
}

function base(): string {
  return `https://graph.facebook.com/${version()}`;
}

async function graphRequest<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new MetaError(`Kunne ikke nå Meta Graph API: ${(e as Error).message}`);
  }
  const json = (await res.json()) as T & {
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok || json.error) {
    const msg =
      json.error?.error_user_msg ||
      json.error?.message ||
      `Graph API fejl (HTTP ${res.status})`;
    throw new MetaError(msg);
  }
  return json;
}

/** Single object fetch: GET /{path}?fields=... */
async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({
    ...params,
    access_token: requireEnv("META_ACCESS_TOKEN"),
  });
  return graphRequest<T>(`${base()}/${path}?${qs.toString()}`);
}

/** Follows `paging.next` until exhausted (capped) and concatenates `data`. */
async function graphGetAll<T>(
  path: string,
  params: Record<string, string>,
  cap = 2000,
): Promise<T[]> {
  const qs = new URLSearchParams({
    ...params,
    access_token: requireEnv("META_ACCESS_TOKEN"),
  });
  let url: string | undefined = `${base()}/${path}?${qs.toString()}`;
  const out: T[] = [];
  while (url && out.length < cap) {
    const page: GraphPage<T> = await graphRequest<GraphPage<T>>(url);
    if (page.data) out.push(...page.data);
    url = page.paging?.next;
  }
  return out;
}

/** Run `fn` over `items` with at most `limit` in flight. Order preserved. */
async function mapLimit<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

function datePreset(range: Range): string {
  switch (range) {
    case "yesterday":
      return "yesterday";
    case "last_7d":
      return "last_7d";
    default:
      return "today";
  }
}

// ---------------------------------------------------------------------------
// Raw Graph shapes
// ---------------------------------------------------------------------------

interface RawCampaign {
  id: string;
  name: string;
  effective_status: string;
}

interface RawAction {
  action_type: string;
  value: string;
}

interface RawInsight {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions?: string;
  clicks?: string;
  actions?: RawAction[];
}

interface RawAd {
  id: string;
  name: string;
  adset?: { name?: string };
  campaign?: { id?: string; name?: string };
}

interface RawStorySpec {
  link_data?: {
    image_hash?: string;
    message?: string;
    name?: string;
    description?: string;
    caption?: string;
    picture?: string;
  };
  video_data?: {
    image_hash?: string;
    message?: string;
    video_id?: string;
    title?: string;
    link_description?: string;
    image_url?: string;
  };
}

interface RawCreative {
  id?: string;
  object_type?: string;
  body?: string;
  title?: string;
  description?: string;
  call_to_action_type?: string;
  thumbnail_url?: string;
  image_url?: string;
  image_hash?: string;
  video_id?: string;
  object_story_spec?: RawStorySpec;
  // Advantage+ / flexible creatives keep their copy here, not in body/title.
  asset_feed_spec?: {
    bodies?: { text?: string }[];
    titles?: { text?: string }[];
    descriptions?: { text?: string }[];
    call_to_action_types?: string[];
  };
}

interface RawPreviewAd {
  id: string;
  name: string;
  effective_status: string;
  created_time?: string;
  creative?: RawCreative;
  adset?: { id?: string; name?: string; start_time?: string; end_time?: string };
  campaign?: { id?: string; name?: string };
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

export async function fetchActiveCampaigns(): Promise<RawCampaign[]> {
  return graphGetAll<RawCampaign>(account() + "/campaigns", {
    fields: "id,name,effective_status",
    filtering: JSON.stringify([
      { field: "effective_status", operator: "IN", value: ["ACTIVE"] },
    ]),
    limit: "200",
  });
}

/**
 * Metrics for ads that delivered in the window. The `/insights` edge only
 * returns rows for ads with delivery, so ads Meta hasn't spent on yet simply
 * won't appear here — we merge these onto the full active-ad list and default
 * missing metrics to zero. No `spend > 0` filter: an active ad with 0 kr. is
 * still shown.
 */
/** Every ACTIVE ad under the given campaigns, regardless of spend/delivery. */
export async function fetchActiveAds(campaignIds: string[]): Promise<RawAd[]> {
  if (campaignIds.length === 0) return [];
  return graphGetAll<RawAd>(account() + "/ads", {
    fields: "id,name,adset{name},campaign{id,name}",
    filtering: JSON.stringify([
      { field: "campaign.id", operator: "IN", value: campaignIds },
      { field: "ad.effective_status", operator: "IN", value: ["ACTIVE"] },
    ]),
    limit: "500",
  });
}

export async function fetchAdInsights(
  range: Range,
  campaignIds: string[],
): Promise<RawInsight[]> {
  if (campaignIds.length === 0) return [];
  return graphGetAll<RawInsight>(account() + "/insights", {
    level: "ad",
    date_preset: datePreset(range),
    fields:
      "ad_id,ad_name,adset_name,campaign_id,campaign_name,spend,impressions,clicks,actions",
    filtering: JSON.stringify([
      { field: "campaign.id", operator: "IN", value: campaignIds },
      { field: "ad.effective_status", operator: "IN", value: ["ACTIVE"] },
    ]),
    limit: "500",
  });
}

async function fetchCreative(adId: string): Promise<RawCreative> {
  const data = await graphGet<{ creative?: RawCreative }>(adId, {
    fields:
      "creative{id,object_type,body,title,call_to_action_type,thumbnail_url,image_url,image_hash,video_id,object_story_spec}",
  });
  return data.creative ?? {};
}

async function fetchLargeThumb(creativeId: string): Promise<string | null> {
  try {
    const data = await graphGet<{ thumbnail_url?: string }>(creativeId, {
      fields: "thumbnail_url",
      thumbnail_width: "1080",
      thumbnail_height: "1350",
    });
    return data.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

async function fetchPreviewIframe(
  adId: string,
  adFormat: string = FEED_FORMAT,
): Promise<string | null> {
  try {
    const page = await graphGet<GraphPage<{ body?: string }>>(`${adId}/previews`, {
      ad_format: adFormat,
    });
    const body = page.data?.[0]?.body;
    if (!body) return null;
    const match = body.match(/src="([^"]+)"/);
    if (!match) return null;
    // The src is HTML-entity encoded inside the iframe markup.
    return match[1].replace(/&amp;/g, "&");
  } catch {
    return null;
  }
}

/** Pick the preview format + native render size for an ad's media aspect. */
function previewFormatFor(ratio: number | null): {
  format: string;
  size: { width: number; height: number };
  vertical: boolean;
} {
  const vertical = ratio != null && ratio > 0 && ratio < PORTRAIT_MAX_ASPECT;
  return vertical
    ? { format: STORY_FORMAT, size: STORY_SIZE, vertical: true }
    : { format: FEED_FORMAT, size: FEED_SIZE, vertical: false };
}

/** Small thumbnail straight off the ad's creative — used for overview tiles. */
async function fetchSmallThumb(adId: string): Promise<string | null> {
  try {
    const data = await graphGet<{ creative?: { thumbnail_url?: string } }>(adId, {
      fields: "creative{thumbnail_url}",
    });
    return data.creative?.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

const RESULT_ACTION_TYPES = new Set([
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
  "omni_purchase",
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
  "complete_registration",
  "offsite_conversion.fb_pixel_complete_registration",
]);

function extractResults(actions: RawAction[] | undefined): number | null {
  if (!actions) return null;
  let total = 0;
  for (const a of actions) {
    if (RESULT_ACTION_TYPES.has(a.action_type)) total += Number(a.value) || 0;
  }
  return total > 0 ? total : null;
}

function imageHashOf(c: RawCreative): string | null {
  return (
    c.image_hash ??
    c.object_story_spec?.link_data?.image_hash ??
    c.object_story_spec?.video_data?.image_hash ??
    null
  );
}

function bodyOf(c: RawCreative): string | null {
  return (
    c.body ??
    c.object_story_spec?.link_data?.message ??
    c.object_story_spec?.video_data?.message ??
    c.asset_feed_spec?.bodies?.[0]?.text ??
    null
  );
}

function citiesIn(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return DK_CITIES.filter((city) => {
    const re = new RegExp(`(^|[^a-zæøå])${city.toLowerCase()}([^a-zæøå]|$)`, "i");
    return re.test(lower);
  });
}

/** Flag when the ad name names a city but the copy names a different one. */
function copyCheck(adName: string, body: string | null): string | undefined {
  const nameCities = citiesIn(adName);
  if (nameCities.length === 0) return undefined;
  const bodyCities = citiesIn(body);
  const mismatch = bodyCities.find(
    (c) => !nameCities.some((n) => n.toLowerCase() === c.toLowerCase()),
  );
  return mismatch;
}

function adsManagerUrl(adId: string): string {
  return `https://www.facebook.com/adsmanager/manage/ads/edit?act=${accountNumeric()}&selected_ad_ids=${adId}`;
}

function stripPrefix(name: string): string {
  return name.replace(/^\s*Marketingly:\s*/i, "").trim();
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

interface AdBase {
  adId: string;
  adName: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
}

interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  results: number | null;
}

const ZERO_METRICS: AdMetrics = { spend: 0, impressions: 0, clicks: 0, results: null };

function metricsOf(r: RawInsight): AdMetrics {
  return {
    spend: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    results: extractResults(r.actions),
  };
}

async function enrichAd(base: AdBase, metrics: AdMetrics): Promise<AdItem> {
  const creative = await fetchCreative(base.adId).catch(() => ({}) as RawCreative);
  const ratio = await fetchImageAspect(mediaImageUrlOf(creative));
  const { format, size, vertical } = previewFormatFor(ratio);
  const [previewSrc, largeThumb] = await Promise.all([
    fetchPreviewIframe(base.adId, format),
    creative.id ? fetchLargeThumb(creative.id) : Promise.resolve(null),
  ]);
  const isVideo = creative.object_type === "VIDEO" || Boolean(creative.video_id);
  const body = bodyOf(creative);
  const mismatchCity = copyCheck(base.adName, body);

  return {
    adId: base.adId,
    adName: base.adName,
    adsetName: base.adsetName,
    campaignId: base.campaignId,
    campaignName: base.campaignName,
    spend: metrics.spend,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    results: metrics.results,
    creativeId: creative.id ?? null,
    videoId: creative.video_id ?? null,
    imageHash: imageHashOf(creative),
    preview: {
      iframeSrc: previewSrc,
      previewWidth: size.width,
      previewHeight: size.height,
      vertical,
      thumbnailUrl: largeThumb ?? creative.thumbnail_url ?? creative.image_url ?? null,
      isVideo,
      body,
      title: creative.title ?? creative.object_story_spec?.link_data?.name ?? null,
      ctaType: creative.call_to_action_type ?? null,
    },
    flags: mismatchCity ? { checkCopy: true, checkCopyCity: mismatchCity } : {},
    adsManagerUrl: adsManagerUrl(base.adId),
  };
}

/** Tag ads that share a creative/video/image within the same campaign. */
function markDuplicates(ads: AdItem[]): void {
  const seen = new Map<string, number>();
  for (const ad of ads) {
    const key = ad.creativeId || ad.videoId || ad.imageHash;
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const ad of ads) {
    const key = ad.creativeId || ad.videoId || ad.imageHash;
    if (key && (seen.get(key) ?? 0) > 1) ad.flags.duplicate = true;
  }
}

export async function buildArtistResponse(
  slug: string,
  range: Range,
  role: Role = "admin",
): Promise<ArtistResponse> {
  const artist = ARTISTS_BY_SLUG[slug];
  if (!artist) throw new MetaError(`Ukendt kunstner: ${slug}`);

  const allCampaigns = await fetchActiveCampaigns();
  const campaigns = allCampaigns.filter((c) => campaignMatchesArtist(c.name, artist));
  const campaignIds = campaigns.map((c) => c.id);

  // Every active ad is shown; insights only supply metrics (0 when undelivered).
  const [activeAds, insights] = await Promise.all([
    fetchActiveAds(campaignIds),
    fetchAdInsights(range, campaignIds),
  ]);
  const metricsByAd = new Map(insights.map((r) => [r.ad_id, metricsOf(r)]));

  const bases: AdBase[] = activeAds.map((a) => ({
    adId: a.id,
    adName: a.name,
    adsetName: a.adset?.name ?? "",
    campaignId: a.campaign?.id ?? "",
    campaignName: a.campaign?.name ?? "",
  }));
  // Highest spenders first; undelivered (0 kr.) ads fall to the end.
  bases.sort(
    (a, b) =>
      (metricsByAd.get(b.adId)?.spend ?? 0) - (metricsByAd.get(a.adId)?.spend ?? 0),
  );

  const ads = await mapLimit(bases, PREVIEW_CONCURRENCY, (base) =>
    enrichAd(base, metricsByAd.get(base.adId) ?? ZERO_METRICS),
  );

  const byCampaign = new Map<string, CampaignGroup>();
  for (const camp of campaigns) {
    byCampaign.set(camp.id, {
      campaignId: camp.id,
      campaignName: camp.name,
      displayName: stripPrefix(camp.name),
      spend: 0,
      ads: [],
    });
  }
  for (const ad of ads) {
    let group = byCampaign.get(ad.campaignId);
    if (!group) {
      group = {
        campaignId: ad.campaignId,
        campaignName: ad.campaignName,
        displayName: stripPrefix(ad.campaignName),
        spend: 0,
        ads: [],
      };
      byCampaign.set(ad.campaignId, group);
    }
    group.spend += ad.spend;
    group.ads.push(ad);
  }

  const groups = [...byCampaign.values()].filter((g) => g.ads.length > 0);
  for (const g of groups) markDuplicates(g.ads);
  groups.sort((a, b) => b.spend - a.spend);

  const response: ArtistResponse = {
    slug: artist.slug,
    name: artist.name,
    range,
    totalSpend: ads.reduce((s, a) => s + a.spend, 0),
    activeAds: ads.length,
    impressions: ads.reduce((s, a) => s + a.impressions, 0),
    clicks: ads.reduce((s, a) => s + a.clicks, 0),
    results: ads.reduce((s, a) => s + (a.results ?? 0), 0),
    campaigns: groups,
  };
  return role === "client" ? stripArtistForClient(response) : response;
}

export async function buildOverview(
  range: Range,
  role: Role = "admin",
): Promise<OverviewResponse> {
  const allCampaigns = await fetchActiveCampaigns();
  const matched = allCampaigns
    .map((c) => ({ campaign: c, artist: artistForCampaign(c.name) }))
    .filter((x): x is { campaign: RawCampaign; artist: Artist } => Boolean(x.artist));

  const campaignIds = matched.map((m) => m.campaign.id);
  // Count every active ad; insights only supply spend/impressions.
  const [activeAdsList, insights] = await Promise.all([
    fetchActiveAds(campaignIds),
    fetchAdInsights(range, campaignIds),
  ]);
  const metricsByAd = new Map(insights.map((r) => [r.ad_id, metricsOf(r)]));

  const campaignToArtist = new Map<string, string>();
  for (const { campaign, artist } of matched) campaignToArtist.set(campaign.id, artist.slug);

  interface Agg {
    spend: number;
    activeAds: number;
    impressions: number;
    campaignIds: Set<string>;
    topAds: { adId: string; spend: number }[];
  }
  const agg = new Map<string, Agg>();
  for (const artist of ARTISTS) {
    agg.set(artist.slug, {
      spend: 0,
      activeAds: 0,
      impressions: 0,
      campaignIds: new Set(),
      topAds: [],
    });
  }

  for (const ad of activeAdsList) {
    const campaignId = ad.campaign?.id;
    if (!campaignId) continue;
    const slug = campaignToArtist.get(campaignId);
    if (!slug) continue;
    const a = agg.get(slug);
    if (!a) continue;
    const m = metricsByAd.get(ad.id) ?? ZERO_METRICS;
    a.spend += m.spend;
    a.activeAds += 1;
    a.impressions += m.impressions;
    a.campaignIds.add(campaignId);
    a.topAds.push({ adId: ad.id, spend: m.spend });
  }

  // Thumbnails for the top 3 ads per artist (small creative thumbnails).
  const thumbTargets: { slug: string; adId: string }[] = [];
  for (const [slug, a] of agg) {
    a.topAds.sort((x, y) => y.spend - x.spend);
    for (const t of a.topAds.slice(0, 3)) thumbTargets.push({ slug, adId: t.adId });
  }
  const thumbs = await mapLimit(thumbTargets, PREVIEW_CONCURRENCY, async (t) => ({
    slug: t.slug,
    url: await fetchSmallThumb(t.adId),
  }));
  const thumbsBySlug = new Map<string, string[]>();
  for (const { slug, url } of thumbs) {
    if (!url) continue;
    const list = thumbsBySlug.get(slug) ?? [];
    list.push(url);
    thumbsBySlug.set(slug, list);
  }

  const artists: ArtistSummary[] = ARTISTS.map((artist) => {
    const a = agg.get(artist.slug)!;
    return {
      slug: artist.slug,
      name: artist.name,
      activeAds: a.activeAds,
      spend: a.spend,
      impressions: a.impressions,
      thumbnails: thumbsBySlug.get(artist.slug) ?? [],
    };
  });

  const totalSpend = artists.reduce((s, a) => s + a.spend, 0);
  const activeAds = artists.reduce((s, a) => s + a.activeAds, 0);
  const campaignsRunning = new Set<string>();
  for (const a of agg.values()) for (const id of a.campaignIds) campaignsRunning.add(id);
  const biggest = [...artists].sort((a, b) => b.spend - a.spend)[0];

  const response: OverviewResponse = {
    range,
    totalSpend,
    activeAds,
    campaignsRunning: campaignsRunning.size,
    biggestSpender:
      biggest && biggest.spend > 0
        ? { slug: biggest.slug, name: biggest.name, spend: biggest.spend }
        : null,
    artists,
  };
  return role === "client" ? stripOverviewForClient(response) : response;
}

// ---------------------------------------------------------------------------
// Client stripping — spend/performance must never reach the client browser,
// not even in the network tab. Counts, names, creatives and previews stay.
// ---------------------------------------------------------------------------

export function stripArtistForClient(r: ArtistResponse): ArtistResponse {
  return {
    ...r,
    totalSpend: 0,
    impressions: 0,
    clicks: 0,
    results: 0,
    campaigns: r.campaigns.map((c) => ({
      ...c,
      spend: 0,
      // Drop adsManagerUrl entirely — it exposes the account id (act=…).
      ads: c.ads.map(({ adsManagerUrl: _drop, ...ad }) => ({
        ...ad,
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: null,
      })),
    })),
  };
}

export function stripOverviewForClient(r: OverviewResponse): OverviewResponse {
  return {
    ...r,
    totalSpend: 0,
    biggestSpender: null,
    artists: r.artists.map((a) => ({ ...a, spend: 0, impressions: 0 })),
  };
}

// ---------------------------------------------------------------------------
// Preview / approval
// ---------------------------------------------------------------------------

// Ads that are set up but not delivering yet (§1). Ad-level statuses only —
// NOT the parent-paused variants (CAMPAIGN_PAUSED/ADSET_PAUSED), which would
// surface the whole historical backlog of paused ads. "SCHEDULED" isn't a real
// ad effective_status, so future-scheduled ads are caught via ACTIVE + a future
// ad-set start_time.
const PREVIEW_STATUSES = ["PAUSED", "IN_PROCESS", "PENDING_REVIEW", "WITH_ISSUES", "ACTIVE"];
const NOT_LIVE_STATUSES = new Set([
  "PAUSED",
  "IN_PROCESS",
  "PENDING_REVIEW",
  "WITH_ISSUES",
]);
// Only consider recently-created ads — an account accumulates hundreds of old
// paused ads otherwise. New ads awaiting approval are made within this window.
const PREVIEW_MAX_AGE_DAYS = 45;

// Keep the list query light (Meta rejects large nested payloads across many ads);
// full creative details are fetched only for the ads that actually qualify.
// Scoped server-side to recently-created ads.
async function fetchPreviewCandidates(): Promise<RawPreviewAd[]> {
  const since = Math.floor(Date.now() / 1000) - PREVIEW_MAX_AGE_DAYS * 86400;
  return graphGetAll<RawPreviewAd>(account() + "/ads", {
    fields:
      "id,name,created_time,effective_status,creative{id},adset{id,name,start_time,end_time},campaign{id,name}",
    filtering: JSON.stringify([
      { field: "ad.effective_status", operator: "IN", value: PREVIEW_STATUSES },
      { field: "created_time", operator: "GREATER_THAN", value: since },
    ]),
    limit: "200",
  });
}

/** Of the given ads, which have ever delivered (lifetime impressions > 0). */
async function fetchDeliveredAdIds(adIds: string[]): Promise<Set<string>> {
  if (adIds.length === 0) return new Set();
  const rows = await graphGetAll<{ ad_id: string }>(
    account() + "/insights",
    {
      level: "ad",
      date_preset: "maximum",
      fields: "ad_id",
      filtering: JSON.stringify([
        { field: "ad.id", operator: "IN", value: adIds },
        { field: "impressions", operator: "GREATER_THAN", value: 0 },
      ]),
      limit: "500",
    },
    50000,
  );
  return new Set(rows.map((r) => r.ad_id));
}

async function fetchPreviewCreative(adId: string): Promise<RawCreative> {
  const data = await graphGet<{ creative?: RawCreative }>(adId, {
    fields:
      "creative{id,object_type,body,title,call_to_action_type,thumbnail_url,image_url,image_hash,video_id,object_story_spec{link_data{message,name,description,caption,picture},video_data{message,title,link_description,image_url}},asset_feed_spec{bodies,titles,descriptions,call_to_action_types}}",
  });
  return data.creative ?? {};
}

function qualifiesForPreview(ad: RawPreviewAd): boolean {
  if (!ad.name || ad.name.trimStart().startsWith("SLET |")) return false;
  if (NOT_LIVE_STATUSES.has(ad.effective_status)) return true;
  if (ad.effective_status === "ACTIVE") {
    const start = ad.adset?.start_time ? Date.parse(ad.adset.start_time) : NaN;
    return Number.isFinite(start) && start > Date.now();
  }
  return false;
}

function headlineOf(c: RawCreative): string | null {
  return (
    c.title ??
    c.object_story_spec?.link_data?.name ??
    c.object_story_spec?.video_data?.title ??
    c.asset_feed_spec?.titles?.[0]?.text ??
    null
  );
}

function descriptionOf(c: RawCreative): string | null {
  return (
    c.description ??
    c.object_story_spec?.link_data?.description ??
    c.object_story_spec?.video_data?.link_description ??
    c.asset_feed_spec?.descriptions?.[0]?.text ??
    null
  );
}

export async function buildPreview(
  role: Role = "admin",
  opts: { withPreviews?: boolean } = {},
): Promise<PreviewResponse> {
  const withPreviews = opts.withPreviews ?? true;
  const candidates = await fetchPreviewCandidates();

  const matched = candidates
    .filter(qualifiesForPreview)
    .map((ad) => ({ ad, artist: artistForCampaign(ad.campaign?.name ?? "") }))
    .filter((x): x is { ad: RawPreviewAd; artist: Artist } => Boolean(x.artist));

  // "Not yet delivering" (§1): drop any candidate that has already delivered,
  // keeping only ads awaiting their first launch.
  const delivered = await fetchDeliveredAdIds(matched.map(({ ad }) => ad.id));
  const qualifying = matched.filter(({ ad }) => !delivered.has(ad.id));

  // Full creative + live, non-persisted preview (feed, or Story for vertical) —
  // only for qualifying ads, and skipped entirely for the agent endpoint.
  const detailByAd = new Map<
    string,
    {
      creative: RawCreative;
      iframe: string | null;
      size: { width: number; height: number };
      vertical: boolean;
    }
  >();
  if (withPreviews) {
    const details = await mapLimit(qualifying, PREVIEW_CONCURRENCY, async ({ ad }) => {
      const creative = await fetchPreviewCreative(ad.id).catch(() => ({}) as RawCreative);
      const ratio = await fetchImageAspect(mediaImageUrlOf(creative));
      const { format, size, vertical } = previewFormatFor(ratio);
      const iframe = await fetchPreviewIframe(ad.id, format);
      return { id: ad.id, creative, iframe, size, vertical };
    });
    for (const d of details)
      detailByAd.set(d.id, {
        creative: d.creative,
        iframe: d.iframe,
        size: d.size,
        vertical: d.vertical,
      });
  }

  const { approvals, feedback } = await readState(
    qualifying.map(({ ad }) => ({ adId: ad.id, creativeId: ad.creative?.id ?? null })),
  );

  // Group artist -> campaign, preserving ARTISTS order.
  const bySlug = new Map<string, PreviewArtistGroup>();
  for (const { ad, artist } of qualifying) {
    const detail = detailByAd.get(ad.id);
    const creative = detail?.creative ?? ad.creative ?? {};
    const creativeId = creative.id ?? ad.creative?.id ?? null;
    const open = (feedback.get(ad.id) ?? []).filter((f) => !f.resolved);
    const approval = approvals.get(ad.id) ?? null;
    const status: PreviewStatus =
      open.length > 0 ? "rettelser" : approval ? "godkendt" : "afventer";

    const item: PreviewAd = {
      adId: ad.id,
      adName: ad.name,
      creativeId,
      effectiveStatus: ad.effective_status,
      adsetName: ad.adset?.name ?? "",
      startTime: ad.adset?.start_time ?? null,
      endTime: ad.adset?.end_time ?? null,
      campaignId: ad.campaign?.id ?? "",
      campaignName: ad.campaign?.name ?? "",
      displayName: stripPrefix(ad.campaign?.name ?? ""),
      preview: {
        iframeSrc: detail?.iframe ?? null,
        previewWidth: detail?.size.width ?? FEED_SIZE.width,
        previewHeight: detail?.size.height ?? FEED_SIZE.height,
        vertical: detail?.vertical ?? false,
        thumbnailUrl: creative.thumbnail_url ?? creative.image_url ?? null,
        isVideo: creative.object_type === "VIDEO" || Boolean(creative.video_id),
        body: bodyOf(creative),
        title: headlineOf(creative),
        description: descriptionOf(creative),
        ctaType:
          creative.call_to_action_type ??
          creative.asset_feed_spec?.call_to_action_types?.[0] ??
          null,
      },
      status,
      approvedBy: approval?.approvedBy,
      approvedAt: approval?.approvedAt,
      feedback: feedback.get(ad.id) ?? [],
      adsManagerUrl: role === "admin" ? adsManagerUrl(ad.id) : undefined,
    };

    let group = bySlug.get(artist.slug);
    if (!group) {
      group = { slug: artist.slug, name: artist.name, pendingCount: 0, campaigns: [] };
      bySlug.set(artist.slug, group);
    }
    let campaign = group.campaigns.find((c) => c.campaignId === item.campaignId);
    if (!campaign) {
      campaign = {
        campaignId: item.campaignId,
        displayName: item.displayName,
        ads: [],
      };
      group.campaigns.push(campaign);
    }
    campaign.ads.push(item);
    if (status !== "godkendt") group.pendingCount += 1;
  }

  const artists = ARTISTS.map((a) => bySlug.get(a.slug)).filter(
    (g): g is PreviewArtistGroup => Boolean(g),
  );

  return { role, artists };
}
