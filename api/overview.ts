import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guard } from "./_lib/auth";
import { sendError, setCache, wantsNoCache } from "./_lib/http";
import { isRange, type Range } from "../shared/types";
import { buildOverview } from "./_lib/meta";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guard(req, res)) return;

  const range: Range = isRange(req.query.range) ? req.query.range : "today";

  try {
    const data = await buildOverview(range);
    setCache(res, wantsNoCache(req));
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
