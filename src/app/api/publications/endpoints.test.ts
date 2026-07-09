import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { generatedContent: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({ id: "c1" }) } },
}));

import { GET as due } from "@/app/api/publications/due/route";
import { PATCH as success } from "@/app/api/publications/[id]/success/route";
import { prisma } from "@/lib/prisma";

beforeEach(() => { vi.clearAllMocks(); process.env.N8N_WEBHOOK_SECRET = "s"; });

const withSecret = (url: string, init: RequestInit = {}) =>
  new Request(url, { ...init, headers: { ...(init.headers ?? {}), "x-webhook-secret": "s" } });

describe("publications endpoints", () => {
  it("due 401 without secret", async () => {
    const res = await due(new Request("http://t/api/publications/due"));
    expect(res.status).toBe(401);
  });
  it("due 200 with secret", async () => {
    const res = await due(withSecret("http://t/api/publications/due"));
    expect(res.status).toBe(200);
  });
  it("success sets PUBBLICATO + publicationStatus", async () => {
    const res = await success(withSecret("http://t/api/publications/c1/success", { method: "PATCH", body: JSON.stringify({ url: "https://x" }) }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect((prisma.generatedContent.update as any)).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "PUBBLICATO", publicationStatus: "PUBBLICATO" }) }));
  });
});
