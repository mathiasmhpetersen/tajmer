import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

process.env.PREVIEW_AGENT_TOKEN = "test-token";
const { GET, POST } = await import("./mcp.js");

// Bridge Node's http server to the web-standard GET/POST handlers so a real MCP
// client can talk to them over a socket (streaming the response for SSE).
let server: http.Server;
let url: URL;

beforeAll(async () => {
  server = http.createServer(async (nreq, nres) => {
    const chunks: Buffer[] = [];
    for await (const c of nreq) chunks.push(c as Buffer);
    const hasBody = nreq.method !== "GET" && nreq.method !== "HEAD" && chunks.length > 0;
    const request = new Request(`http://localhost${nreq.url}`, {
      method: nreq.method,
      headers: nreq.headers as Record<string, string>,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });
    const res = nreq.method === "GET" ? await GET(request) : await POST(request);
    nres.writeHead(res.status, Object.fromEntries(res.headers.entries()));
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        nres.write(Buffer.from(value));
      }
    }
    nres.end();
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

  it("lists the five tools over MCP with the bearer token", async () => {
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
