import { describe, expect, it } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "./auth.js";

process.env.PREVIEW_AGENT_TOKEN = "agent-xyz";

function mockReq(headers: Record<string, string> = {}): VercelRequest {
  return { headers } as unknown as VercelRequest;
}

function mockRes() {
  const out: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  };
  return { res: res as unknown as VercelResponse, out };
}

describe("requireAdmin — agent bearer token", () => {
  it("accepts the agent token when allowAgent is set", () => {
    const { res, out } = mockRes();
    const session = requireAdmin(mockReq({ authorization: "Bearer agent-xyz" }), res, { allowAgent: true });
    expect(session).toEqual({ role: "admin" });
    expect(out.status).toBeUndefined();
  });

  it("rejects the agent token when allowAgent is NOT set (401)", () => {
    const { res, out } = mockRes();
    const session = requireAdmin(mockReq({ authorization: "Bearer agent-xyz" }), res, {});
    expect(session).toBeNull();
    expect(out.status).toBe(401);
  });

  it("401 without any auth", () => {
    const { res, out } = mockRes();
    const session = requireAdmin(mockReq(), res, { allowAgent: true });
    expect(session).toBeNull();
    expect(out.status).toBe(401);
  });
});
