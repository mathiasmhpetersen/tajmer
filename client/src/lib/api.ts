import type { ArtistResponse, OverviewResponse, Range } from "@shared/types";

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

export async function login(password: string): Promise<void> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(data?.error || "Forkert adgangskode");
  }
}
