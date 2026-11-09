import type { VercelRequest, VercelResponse } from "@vercel/node";
import { roleForPassword, setAuthCookie } from "./_lib/auth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.SITE_PASSWORD && !process.env.CLIENT_PASSWORD) {
    return res.status(500).json({ error: "Ingen adgangskoder er konfigureret på serveren" });
  }

  const raw = req.body;
  const parsed = typeof raw === "string" ? safeParse(raw) : raw;
  const password = typeof parsed?.password === "string" ? parsed.password : "";

  const role = roleForPassword(password);
  if (!role) {
    return res.status(401).json({ error: "Forkert adgangskode" });
  }

  setAuthCookie(res, role);
  return res.status(200).json({ role });
}

function safeParse(s: string): { password?: unknown } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
