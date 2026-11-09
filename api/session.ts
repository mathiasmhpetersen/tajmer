import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession } from "./_lib/auth.js";

/** Lets the app discover the current role (admin | client) on load. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const session = getSession(req);
  res.setHeader("Cache-Control", "no-store");
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  return res.status(200).json({ role: session.role });
}
