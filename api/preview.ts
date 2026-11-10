import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guard } from "./_lib/auth.js";
import { sendError, setCache } from "./_lib/http.js";
import { buildPreview } from "./_lib/meta.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = guard(req, res);
  if (!session) return;

  try {
    const data = await buildPreview(session.role, { withPreviews: true });
    setCache(res, true); // approval state is live; never cache
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
