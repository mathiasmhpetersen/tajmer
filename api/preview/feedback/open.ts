import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAdminOrAgent } from "../../_lib/auth.js";
import { sendError, setCache } from "../../_lib/http.js";
import { buildPreview } from "../../_lib/meta.js";

/**
 * Read-only, machine-readable list of unresolved corrections + approval states
 * for Marketingly's agent. Auth is the admin login cookie OR a separate bearer
 * token (PREVIEW_AGENT_TOKEN).
 */
export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminOrAgent(req)) {
    return res.status(401).json({ error: "Not authorized" });
  }
  setCache(res, true);

  try {
    const data = await buildPreview("admin", { withPreviews: false });
    const ads = [];
    for (const artist of data.artists) {
      for (const campaign of artist.campaigns) {
        for (const ad of campaign.ads) {
          ads.push({
            adId: ad.adId,
            adName: ad.adName,
            artist: { slug: artist.slug, name: artist.name },
            campaign: campaign.displayName,
            creativeId: ad.creativeId,
            status: ad.status,
            approvedBy: ad.approvedBy ?? null,
            approvedAt: ad.approvedAt ?? null,
            openCorrections: ad.feedback
              .filter((f) => !f.resolved)
              .map((f) => ({
                id: f.id,
                text: f.text,
                role: f.role,
                createdAt: f.createdAt,
              })),
          });
        }
      }
    }
    return res.status(200).json({ generatedAt: new Date().toISOString(), ads });
  } catch (err) {
    return sendError(res, err);
  }
}
