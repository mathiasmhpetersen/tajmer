import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { buildBudgetOverview } from "./_lib/budget.js";
import { buildPreview } from "./_lib/meta.js";
import { readBotState, resolveFeedback, saveBotStatus } from "./_lib/kv.js";

// MCP connector for the Tajmer kunde-bot. Built with mcp-handler's
// createMcpHandler (a framework-agnostic web handler — `next` is an optional
// peer we don't use). This app is Vite + Vercel functions, not Next.js, so the
// route lives at api/mcp.ts (exported as GET/POST web handlers) rather than
// app/api/mcp/route.ts. Tools call the existing app logic directly. Guarded by
// the PREVIEW_AGENT_TOKEN bearer.

export const config = { maxDuration: 60 };

function asText(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Ads with at least one unresolved correction, flattened for the agent. */
async function openCorrections() {
  const data = await buildPreview("admin", { withPreviews: false });
  const ads = [];
  for (const artist of data.artists) {
    for (const campaign of artist.campaigns) {
      for (const ad of campaign.ads) {
        const open = ad.feedback.filter((f) => !f.resolved);
        if (open.length === 0) continue;
        ads.push({
          adId: ad.adId,
          adName: ad.adName,
          artist: { slug: artist.slug, name: artist.name },
          campaign: campaign.displayName,
          creativeId: ad.creativeId,
          status: ad.status,
          openCorrections: open.map((f) => ({
            id: f.id,
            text: f.text,
            role: f.role,
            createdAt: f.createdAt,
            batchId: f.batchId ?? null,
            field: f.field ?? null,
            method: f.method ?? null,
          })),
        });
      }
    }
  }
  return { generatedAt: new Date().toISOString(), ads };
}

const mcp = createMcpHandler(
  (server) => {
    server.registerTool(
      "hent_hukommelse",
      {
        title: "Hent hukommelse",
        description: "Hent bottens gemte statusser, evt. kun dem opdateret siden en ISO-dato.",
        inputSchema: z.object({ since: z.string().optional().describe("ISO-dato, fx 2026-11-01") }),
      },
      async ({ since }) => asText(await readBotState(since)),
    );

    server.registerTool(
      "gem_status",
      {
        title: "Gem status",
        description: "Gem eller opdatér en status for en nøgle.",
        inputSchema: z.object({
          key: z.string().describe("Entydig nøgle, fx 'tajmer:2026-w46'"),
          status: z.enum(["forberedt", "loest"]),
          note: z.string().optional(),
        }),
      },
      async ({ key, status, note }) => asText(await saveBotStatus({ key, status, note })),
    );

    server.registerTool(
      "aabne_rettelser",
      {
        title: "Åbne rettelser",
        description: "Uløste Preview-rettelser pr. annonce, med strukturerede felter.",
        inputSchema: z.object({}),
      },
      async () => asText(await openCorrections()),
    );

    server.registerTool(
      "budget_overblik",
      {
        title: "Budget-overblik",
        description: "Økonomi-overblik pr. kunstner: aftalt, brugt, rest, tempo og advarsler.",
        inputSchema: z.object({}),
      },
      async () => asText(await buildBudgetOverview()),
    );

    server.registerTool(
      "marker_rettelse_loest",
      {
        title: "Markér rettelse som løst",
        description: "Markér en Preview-rettelse som løst, evt. med id på den nye/rettede annonce.",
        inputSchema: z.object({
          adId: z.string(),
          feedbackId: z.string(),
          fixedAdId: z.string().optional().describe("Id på den rettede/nye annonce"),
          note: z.string().optional(),
        }),
      },
      async ({ adId, feedbackId, fixedAdId, note }) => {
        const ok = await resolveFeedback(adId, feedbackId, "admin", { fixedAdId, note });
        return asText({ ok, adId, feedbackId });
      },
    );
  },
  { serverInfo: { name: "tajmer-bot", version: "1.0.0" } },
);

/** 401 unless the Authorization header is exactly "Bearer <PREVIEW_AGENT_TOKEN>". */
async function handler(request: Request): Promise<Response> {
  const expected = `Bearer ${process.env.PREVIEW_AGENT_TOKEN ?? ""}`;
  if (!process.env.PREVIEW_AGENT_TOKEN || (request.headers.get("authorization") ?? "") !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return mcp(request);
}

export { handler as GET, handler as POST };
