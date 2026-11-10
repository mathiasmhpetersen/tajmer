import type { VercelRequest, VercelResponse } from "@vercel/node";
import { guard } from "../../_lib/auth.js";
import { readJsonBody, sendError, setCache } from "../../_lib/http.js";
import { createBatchCorrection, KVError } from "../../_lib/kv.js";
import type {
  ApproveItem,
  CorrectionField,
  CorrectionMethod,
} from "../../../shared/types.js";

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
  const artistSlug = typeof body.artistSlug === "string" ? body.artistSlug : "";
  const field = body.field as CorrectionField;
  const method = (body.method as CorrectionMethod) ?? "replace";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const items = Array.isArray(body.items) ? (body.items as ApproveItem[]) : [];

  if (!artistSlug) return res.status(400).json({ error: "Mangler artistSlug" });
  if (!FIELDS.includes(field)) return res.status(400).json({ error: "Ugyldigt felt" });
  if (field !== "other" && !METHODS.includes(method)) {
    return res.status(400).json({ error: "Ugyldig metode" });
  }
  if (!text) return res.status(400).json({ error: "Rettelsen må ikke være tom" });
  if (items.length === 0) return res.status(400).json({ error: "Vælg mindst én annonce" });

  try {
    const batch = await createBatchCorrection({
      artistSlug,
      field,
      method: field === "other" ? "replace" : method,
      text,
      items: items.map((i) => ({ adId: i.adId, creativeId: i.creativeId ?? null })),
      role: session.role,
    });
    return res.status(200).json({ ok: true, batchId: batch.batchId, count: items.length });
  } catch (err) {
    if (err instanceof KVError) return res.status(503).json({ error: err.message });
    return sendError(res, err);
  }
}
