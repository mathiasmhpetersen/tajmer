import { createSign } from "node:crypto";

// Read-only Google Sheets access via a service account. Credentials live only in
// Vercel env (GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEET_ID) and are never
// committed. Server-side only. We mint a short-lived OAuth token with a signed
// JWT (RS256) instead of pulling in the heavy googleapis SDK.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

/** Thrown when Sheets is unconfigured or a read fails — callers turn it into a warning. */
export class SheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetError";
  }
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new SheetError("GOOGLE_SERVICE_ACCOUNT_JSON mangler");
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new SheetError("GOOGLE_SERVICE_ACCOUNT_JSON er ikke gyldig JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new SheetError("GOOGLE_SERVICE_ACCOUNT_JSON mangler client_email/private_key");
  }
  // Env values sometimes carry escaped newlines in the PEM body.
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = b64url(
    createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key),
  );
  const assertion = `${header}.${claims}.${signature}`;

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
  } catch (e) {
    throw new SheetError(`Kunne ikke nå Google OAuth: ${(e as Error).message}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    throw new SheetError(`Google token-fejl (HTTP ${res.status}): ${json.error ?? "ukendt"}`);
  }
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

/** The budget sheet id (shared across all artists' plan/tiltag tabs). */
export function budgetSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new SheetError("GOOGLE_SHEET_ID mangler");
  return id;
}

export function sheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHEET_ID);
}

/**
 * Read a whole tab as rows of displayed strings (FORMATTED_VALUE keeps dd/mm/yyyy
 * dates and Danish-formatted numbers as the sheet shows them). Cells are always
 * strings; trailing empty cells in a row are omitted by the API.
 */
export async function fetchSheetTab(spreadsheetId: string, tab: string): Promise<string[][]> {
  const token = await getAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(tab)}` +
    `?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new SheetError(`Kunne ikke nå Google Sheets: ${(e as Error).message}`);
  }
  const json = (await res.json()) as { values?: unknown[][]; error?: { message?: string } };
  if (!res.ok) {
    throw new SheetError(json.error?.message ?? `Google Sheets-fejl (HTTP ${res.status})`);
  }
  return (json.values ?? []).map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}
