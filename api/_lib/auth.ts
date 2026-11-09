import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const AUTH_COOKIE = "tajmer_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SIGNED_MESSAGE = "tajmer-auth-v1";

/**
 * The cookie value is an HMAC keyed by SITE_PASSWORD. It can't be forged without
 * knowing the password, and we never store the password itself. Good enough for
 * an internal tool (§6) — no auth provider.
 */
function expectedToken(): string | null {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update(SIGNED_MESSAGE).digest("hex");
}

export function passwordMatches(input: string): boolean {
  const password = process.env.SITE_PASSWORD;
  if (!password) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(password);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function isAuthed(req: VercelRequest): boolean {
  const expected = expectedToken();
  if (!expected) return false;
  const token = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function setAuthCookie(res: VercelResponse): void {
  const token = expectedToken();
  if (!token) return;
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`,
  );
}

/** Returns true if the request is allowed to proceed; otherwise writes a 401. */
export function guard(req: VercelRequest, res: VercelResponse): boolean {
  if (isAuthed(req)) return true;
  res.status(401).json({ error: "Not authenticated" });
  return false;
}
