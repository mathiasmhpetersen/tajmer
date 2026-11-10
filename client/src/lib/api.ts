import type {
  ApproveItem,
  ArtistResponse,
  CorrectionField,
  CorrectionMethod,
  OverviewResponse,
  PreviewResponse,
  Range,
  Role,
  Session,
} from "@shared/types";

/** Thrown on a 401 so React Query can route the app to the login screen. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Thrown for Graph/API errors (502) carrying the user-facing message. */
export class ApiRequestError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data || (data as { error?: string }).error) {
    throw new ApiRequestError(data?.error || `Fejl (HTTP ${res.status})`);
  }
  return data as T;
}

function withParams(path: string, range: Range, nocache: boolean): string {
  const params = new URLSearchParams({ range });
  if (nocache) params.set("nocache", "1");
  return `${path}?${params.toString()}`;
}

export function fetchOverview(range: Range, nocache = false): Promise<OverviewResponse> {
  return getJson<OverviewResponse>(withParams("/api/overview", range, nocache));
}

export function fetchArtist(
  slug: string,
  range: Range,
  nocache = false,
): Promise<ArtistResponse> {
  return getJson<ArtistResponse>(
    withParams(`/api/artist/${encodeURIComponent(slug)}`, range, nocache),
  );
}

export function fetchSession(): Promise<Session> {
  return getJson<Session>("/api/session");
}

export function fetchPreview(): Promise<PreviewResponse> {
  return getJson<PreviewResponse>("/api/preview");
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new UnauthorizedError();
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data || (data as { error?: string }).error) {
    throw new ApiRequestError(data?.error || `Fejl (HTTP ${res.status})`);
  }
  return data as T;
}

export function approveAd(adId: string, creativeId: string | null, approved: boolean) {
  return postJson("/api/preview/approve", { adId, creativeId, approved });
}

export function approveBulk(items: ApproveItem[], approved: boolean) {
  return postJson("/api/preview/approve", { items, approved });
}

export function sendFeedback(
  adId: string,
  creativeId: string | null,
  text: string,
  opts: { field?: CorrectionField; method?: CorrectionMethod } = {},
) {
  return postJson("/api/preview/feedback", { adId, creativeId, text, ...opts });
}

export function resolveFeedback(
  adId: string,
  feedbackId: string,
  opts: { note?: string; fixedAdId?: string } = {},
) {
  return postJson("/api/preview/feedback/resolve", { adId, feedbackId, ...opts });
}

export function createBulkCorrection(input: {
  artistSlug: string;
  field: CorrectionField;
  method: CorrectionMethod;
  text: string;
  items: ApproveItem[];
}) {
  return postJson("/api/preview/feedback/batch", input);
}

export async function login(password: string): Promise<Role> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => null)) as
    | { role?: Role; error?: string }
    | null;
  if (!res.ok || !data?.role) {
    throw new ApiRequestError(data?.error || "Forkert adgangskode");
  }
  return data.role;
}
