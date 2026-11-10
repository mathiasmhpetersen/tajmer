import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guard } from "../_lib/auth.js";
import { readJsonBody, sendError, setCache } from "../_lib/http.js";
import { clearApproval, KVError, setApproval } from "../_lib/kv.js";
import type { ApproveItem } from "../../shared/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = guard(req, res);
  if (!session) return;
  setCache(res, true);

  const body = readJsonBody(req);
  const approved = Boolean(body.approved);

  try {
    // Bulk: { items: [{ adId, creativeId }], approved }
    if (Array.isArray(body.items)) {
      const items = body.items as ApproveItem[];
      await Promise.all(
        items.map((it) =>
          approved
            ? setApproval(it.adId, it.creativeId ?? null, session.role)
            : clearApproval(it.adId, it.creativeId ?? null),
        ),
      );
      return res.status(200).json({ ok: true, count: items.length });
    }

    // Single: { adId, creativeId, approved }
    const adId = typeof body.adId === "string" ? body.adId : null;
    if (!adId) return res.status(400).json({ error: "Mangler adId" });
    const creativeId = typeof body.creativeId === "string" ? body.creativeId : null;

    if (approved) {
      const approval = await setApproval(adId, creativeId, session.role);
      return res.status(200).json({ ok: true, approval });
    }
    await clearApproval(adId, creativeId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof KVError) return res.status(503).json({ error: err.message });
    return sendError(res, err);
  }
}
