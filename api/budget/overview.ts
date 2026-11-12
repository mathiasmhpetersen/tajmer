import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../_lib/auth.js";
import { sendError, setCache, wantsNoCache } from "../_lib/http.js";
import { budgetClientEnabled, buildBudgetOverview } from "../_lib/budget.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = requireAdmin(req, res, { allowClient: budgetClientEnabled(), allowAgent: true });
  if (!session) return;
  try {
    const data = await buildBudgetOverview();
    setCache(res, wantsNoCache(req));
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
