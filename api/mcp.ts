import type { VercelRequest, VercelResponse } from "@vercel/node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { buildBudgetOverview } from "./_lib/budget.js";
import { buildPreview } from "./_lib/meta.js";
import { readBotState, resolveFeedback, saveBotStatus } from "./_lib/kv.js";

// MCP connector for the Tajmer kunde-bot. Exposes a few read/act tools backed by
// our existing app logic (called directly, not over HTTP). Streamable-HTTP MCP
// transport over a plain Vercel function (this app is Vite + Vercel functions,
// not Next.js, so we use the official SDK directly rather than mcp-handler, which
// requires Next). Guarded by the PREVIEW_AGENT_TOKEN bearer.

export const config = { maxDuration: 60 };

function bearerOk(req: VercelRequest): boolean {
  const expected = process.env.PREVIEW_AGENT_TOKEN;
  if (!expected) return false;
  return (req.headers.authorization ?? "") === `Bearer ${expected}`;
}

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

function buildServer(): McpServer {
  const server = new McpServer({ name: "tajmer-bot", version: "1.0.0" });

  server.registerTool(
    "hent_hukommelse",
    {
      title: "Hent hukommelse",
      description: "Hent bottens gemte statusser, evt. kun dem opdateret siden en ISO-dato.",
      inputSchema: { since: z.string().optional().describe("ISO-dato, fx 2026-11-01") },
    },
    async ({ since }) => asText(await readBotState(since)),
  );

  server.registerTool(
    "gem_status",
    {
      title: "Gem status",
      description: "Gem eller opdatér en status for en nøgle (fx en uge eller en opgave).",
      inputSchema: {
        key: z.string().describe("Entydig nøgle, fx 'tajmer:2026-w46'"),
        status: z.enum(["forberedt", "loest"]),
        note: z.string().optional(),
      },
    },
    async ({ key, status, note }) => asText(await saveBotStatus({ key, status, note })),
  );

  server.registerTool(
    "aabne_rettelser",
    {
      title: "Åbne rettelser",
      description: "Uløste Preview-rettelser pr. annonce, med strukturerede felter.",
    },
    async () => asText(await openCorrections()),
  );

  server.registerTool(
    "budget_overblik",
    {
      title: "Budget-overblik",
      description: "Økonomi-overblik pr. kunstner: aftalt, brugt, rest, tempo og advarsler.",
    },
    async () => asText(await buildBudgetOverview()),
  );

  server.registerTool(
    "marker_rettelse_loest",
    {
      title: "Markér rettelse som løst",
      description: "Markér en Preview-rettelse som løst, evt. med id på den nye/rettede annonce.",
      inputSchema: {
        adId: z.string(),
        feedbackId: z.string(),
        fixedAdId: z.string().optional().describe("Id på den rettede/nye annonce"),
        note: z.string().optional(),
      },
    },
    async ({ adId, feedbackId, fixedAdId, note }) => {
      const ok = await resolveFeedback(adId, feedbackId, "admin", { fixedAdId, note });
      return asText({ ok, adId, feedbackId });
    },
  );

  return server;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!bearerOk(req)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  const server = buildServer();
  // Stateless: a fresh server + transport per request (serverless-friendly).
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
