import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../_lib/auth.js";
import { readJsonBody, sendError, setCache } from "../_lib/http.js";
import { KVError, readBudgetDoc, writeBudgetDoc } from "../_lib/kv.js";
import { seedDoc } from "../_lib/budget-data.js";
import type { BudgetPlanDoc, PlanRowInput, TiltagRowInput } from "../../shared/budget.js";

export const config = { maxDuration: 30 };

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function sanitizePlan(v: unknown): PlanRowInput[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        artist: str(o.artist).trim(),
        fra: str(o.fra).trim(),
        til: str(o.til).trim(),
        dagsbudget: str(o.dagsbudget).trim(),
        type: str(o.type).trim(),
        periode: str(o.periode).trim(),
        periodebudget: str(o.periodebudget).trim(),
        note: str(o.note).trim(),
      };
    })
    .filter((r) => r.artist || r.fra || r.periodebudget || r.dagsbudget);
}

function sanitizeTiltag(v: unknown): TiltagRowInput[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        artist: str(o.artist).trim(),
        fra: str(o.fra).trim(),
        til: str(o.til).trim(),
        gentagelse: str(o.gentagelse).trim(),
        titel: str(o.titel).trim(),
        kilde: str(o.kilde).trim(),
      };
    })
    .filter((r) => r.artist || r.titel);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Editing is admin-only, regardless of any client-read flag.
  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    if (req.method === "POST") {
      const body = readJsonBody(req);
      const doc: BudgetPlanDoc = {
        plan: sanitizePlan(body.plan),
        tiltag: sanitizeTiltag(body.tiltag),
      };
      await writeBudgetDoc(doc);
      setCache(res, true);
      return res.status(200).json({ ok: true, plan: doc.plan.length, tiltag: doc.tiltag.length });
    }

    const kvDoc = await readBudgetDoc();
    const doc = kvDoc ?? seedDoc();
    setCache(res, true);
    return res.status(200).json({ ...doc, source: kvDoc ? "kv" : "seed" });
  } catch (err) {
    if (err instanceof KVError) return res.status(503).json({ error: err.message });
    return sendError(res, err);
  }
}
