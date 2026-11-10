import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAdminOrAgent } from "../../_lib/auth.js";
import { readJsonBody, sendError, setCache } from "../../_lib/http.js";
import { KVError, resolveFeedback } from "../../_lib/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Admin cookie OR the agent bearer token.
  if (!isAdminOrAgent(req)) {
    return res.status(401).json({ error: "Not authorized" });
  }
  setCache(res, true);

  const body = readJsonBody(req);
  const adId = typeof body.adId === "string" ? body.adId : null;
  const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId : null;
  const note = typeof body.note === "string" ? body.note.trim() || undefined : undefined;
  const fixedAdId = typeof body.fixedAdId === "string" ? body.fixedAdId.trim() || undefined : undefined;
  if (!adId || !feedbackId) return res.status(400).json({ error: "Mangler adId/feedbackId" });

  try {
    const ok = await resolveFeedback(adId, feedbackId, "admin", { note, fixedAdId });
    if (!ok) return res.status(404).json({ error: "Rettelse findes ikke" });
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof KVError) return res.status(503).json({ error: err.message });
    return sendError(res, err);
  }
}
