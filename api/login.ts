import type { VercelRequest, VercelResponse } from "@vercel/node";
import { passwordMatches, setAuthCookie } from "./_lib/auth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.SITE_PASSWORD) {
    return res.status(500).json({ error: "SITE_PASSWORD er ikke konfigureret på serveren" });
  }

  const raw = req.body;
  const parsed = typeof raw === "string" ? safeParse(raw) : raw;
  const password = typeof parsed?.password === "string" ? parsed.password : "";

  if (!passwordMatches(password)) {
    return res.status(401).json({ error: "Forkert adgangskode" });
  }

  setAuthCookie(res);
  return res.status(200).json({ ok: true });
}

function safeParse(s: string): { password?: unknown } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
