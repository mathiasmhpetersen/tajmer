import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guard } from "./_lib/auth.js";
import { sendError, setCache, wantsNoCache } from "./_lib/http.js";
import { isRange, type Range } from "../shared/types.js";
import { buildOverview } from "./_lib/meta.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = guard(req, res);
  if (!session) return;

  const range: Range = isRange(req.query.range) ? req.query.range : "today";

  try {
    const data = await buildOverview(range, session.role);
    setCache(res, wantsNoCache(req));
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
