import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Role, Session } from "../../shared/types.js";

export const AUTH_COOKIE = "tajmer_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// The admin message is unchanged from the original single-role build, so any
// existing admin cookie stays valid — "don't change anything for my login".
const ROLE_MESSAGE: Record<Role, string> = {
  admin: "tajmer-auth-v1",
  client: "tajmer-client-v1",
};

function secretFor(role: Role): string | undefined {
  return role === "admin" ? process.env.SITE_PASSWORD : process.env.CLIENT_PASSWORD;
}

/**
 * Cookie value is an HMAC keyed by that role's password. It can't be forged
 * without the password, and we never store the password itself (§6).
 */
function tokenFor(role: Role): string | null {
  const secret = secretFor(role);
  if (!secret) return null;
  return createHmac("sha256", secret).update(ROLE_MESSAGE[role]).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Which role (if any) does this password unlock? Admin wins ties. */
export function roleForPassword(input: string): Role | null {
  for (const role of ["admin", "client"] as const) {
    const secret = secretFor(role);
    if (secret && safeEqual(input, secret)) return role;
  }
  return null;
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

/** Resolve the session from the auth cookie, or null if unauthenticated. */
export function getSession(req: VercelRequest): Session | null {
  const token = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  if (!token) return null;
  for (const role of ["admin", "client"] as const) {
    const expected = tokenFor(role);
    if (expected && safeEqual(token, expected)) return { role };
  }
  return null;
}

export function setAuthCookie(res: VercelResponse, role: Role): void {
  const token = tokenFor(role);
  if (!token) return;
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`,
  );
}

/** Returns the session if authed; otherwise writes a 401 and returns null. */
export function guard(req: VercelRequest, res: VercelResponse): Session | null {
  const session = getSession(req);
  if (session) return session;
  res.status(401).json({ error: "Not authenticated" });
  return null;
}

/**
 * Admin gate for the Budget tool (and future admin-only features). Returns the
 * session for an admin; otherwise writes 401 (unauthenticated) or 403
 * (authenticated but client) and returns null. Pass `allowClient: true` to open
 * it to the client role behind a flag when a client view is switched on later.
 */
export function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
  opts: { allowClient?: boolean } = {},
): Session | null {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  if (session.role !== "admin" && !opts.allowClient) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return session;
}

/** Valid `Authorization: Bearer <PREVIEW_AGENT_TOKEN>` — for Marketingly's agent. */
export function agentTokenOk(req: VercelRequest): boolean {
  const expected = process.env.PREVIEW_AGENT_TOKEN;
  if (!expected) return false;
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return safeEqual(token, expected);
}

/** True for an admin cookie OR the agent bearer token. */
export function isAdminOrAgent(req: VercelRequest): boolean {
  return getSession(req)?.role === "admin" || agentTokenOk(req);
}
