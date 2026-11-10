import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../../_lib/auth.js";
import { sendError, setCache, wantsNoCache } from "../../_lib/http.js";
import { budgetClientEnabled, buildArtistBudget, isKnownArtist } from "../../_lib/budget.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = requireAdmin(req, res, { allowClient: budgetClientEnabled() });
  if (!session) return;

  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  if (!slug || !isKnownArtist(slug)) {
    return res.status(404).json({ error: "Ukendt kunstner" });
  }

  try {
    const data = await buildArtistBudget(slug);
    setCache(res, wantsNoCache(req));
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
