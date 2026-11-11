import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAdminOrAgent } from "../_lib/auth.js";
import { readJsonBody, sendError, setCache } from "../_lib/http.js";
import { KVError, readBotState, saveBotStatus } from "../_lib/kv.js";

/**
 * The kunde-bot's own memory. GET reads saved statuses (optionally ?since=ISO);
 * POST upserts one ({ key, status, note? }). Auth: admin cookie OR the agent
 * bearer token (PREVIEW_AGENT_TOKEN) — same as the other /api bot endpoints.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminOrAgent(req)) {
    return res.status(401).json({ error: "Not authorized" });
  }
  setCache(res, true);

  try {
    if (req.method === "POST") {
      const body = readJsonBody(req);
      const key = typeof body.key === "string" ? body.key.trim() : "";
      const status = typeof body.status === "string" ? body.status.trim() : "";
      if (!key || !status) return res.status(400).json({ error: "Mangler key/status" });
      const note = typeof body.note === "string" ? body.note : undefined;
      const entry = await saveBotStatus({ key, status, note });
      return res.status(200).json({ ok: true, entry });
    }

    const since = typeof req.query.since === "string" ? req.query.since : undefined;
    const entries = await readBotState(since);
    return res.status(200).json({ generatedAt: new Date().toISOString(), entries });
  } catch (err) {
    if (err instanceof KVError) return res.status(503).json({ error: err.message });
    return sendError(res, err);
  }
}
