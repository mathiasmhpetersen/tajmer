import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

process.env.PREVIEW_AGENT_TOKEN = "test-token";
// Import after the env is set.
const { default: handler } = await import("./mcp.js");

let server: http.Server;
let url: URL;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    // The handler is a Vercel (req,res) function; raw Node req/res are compatible
    // for what the MCP transport and our auth guard use.
    void handler(req as never, res as never);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
});

afterAll(() => server.close());

describe("MCP route", () => {
  it("rejects requests without the bearer token (401)", async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
  });

  it("lists the expected tools over MCP with the bearer token", async () => {
    const client = new Client({ name: "test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: "Bearer test-token" } },
    });
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "aabne_rettelser",
      "budget_overblik",
      "gem_status",
      "hent_hukommelse",
      "marker_rettelse_loest",
    ]);
    await client.close();
  });
});
