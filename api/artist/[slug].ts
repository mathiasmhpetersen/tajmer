import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guard } from "../_lib/auth.js";
import { sendError, setCache, wantsNoCache } from "../_lib/http.js";
import { isRange, type Range } from "../../shared/types.js";
import { buildArtistResponse } from "../_lib/meta.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = guard(req, res);
  if (!session) return;

  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  if (!slug) return res.status(400).json({ error: "Mangler kunstner-slug" });

  const range: Range = isRange(req.query.range) ? req.query.range : "today";

  try {
    const data = await buildArtistResponse(slug, range, session.role);
    setCache(res, wantsNoCache(req));
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
