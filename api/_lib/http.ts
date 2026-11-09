import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Edge-cache for 5 min with a 60s stale-while-revalidate window (§2d). */
export function setCache(res: VercelResponse, nocache: boolean): void {
  res.setHeader(
    "Cache-Control",
    nocache ? "no-store" : "s-maxage=300, stale-while-revalidate=60",
  );
}

export function wantsNoCache(req: VercelRequest): boolean {
  return req.query.nocache === "1" || req.query.nocache === "true";
}

/** The Graph layer throws this; functions turn it into a 502 with the message. */
export class MetaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaError";
  }
}

export function sendError(res: VercelResponse, err: unknown): void {
  const message =
    err instanceof MetaError
      ? err.message
      : err instanceof Error
        ? err.message
        : "Ukendt fejl";
  res.status(502).json({ error: message });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new MetaError(`Mangler miljøvariabel: ${name}`);
  return value;
}
