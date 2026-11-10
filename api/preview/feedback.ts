import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guard } from "../_lib/auth.js";
import { readJsonBody, sendError, setCache } from "../_lib/http.js";
import { addFeedback, KVError } from "../_lib/kv.js";
import type { CorrectionField, CorrectionMethod } from "../../shared/types.js";

const FIELDS: CorrectionField[] = ["headline", "primary_text", "description", "other"];
const METHODS: CorrectionMethod[] = ["replace", "append", "prepend"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = guard(req, res);
  if (!session) return;
  setCache(res, true);

  const body = readJsonBody(req);
  const adId = typeof body.adId === "string" ? body.adId : null;
  const creativeId = typeof body.creativeId === "string" ? body.creativeId : null;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const field = FIELDS.includes(body.field as CorrectionField)
    ? (body.field as CorrectionField)
    : undefined;
  const method =
    field && field !== "other" && METHODS.includes(body.method as CorrectionMethod)
      ? (body.method as CorrectionMethod)
      : undefined;
  if (!adId) return res.status(400).json({ error: "Mangler adId" });
  if (!text) return res.status(400).json({ error: "Rettelsen må ikke være tom" });

  try {
    const item = await addFeedback(adId, creativeId, text, session.role, { field, method });
    return res.status(200).json({ ok: true, item });
  } catch (err) {
    if (err instanceof KVError) return res.status(503).json({ error: err.message });
    return sendError(res, err);
  }
}
