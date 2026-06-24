import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { idea: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } },
}));

import { PATCH } from "@/app/api/ideas/bulk-destinazioni/route";
import { prisma } from "@/lib/prisma";

function req(body: unknown) {
  return new Request("http://test/api/ideas/bulk-destinazioni", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("PATCH /api/ideas/bulk-destinazioni", () => {
  beforeEach(() => vi.clearAllMocks());
  it("updates destinazioni for the given ids", async () => {
    const res = await PATCH(req({ ids: ["a", "b"], destinazioni: ["META", "BLOG"] }));
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(2);
    expect((prisma.idea.updateMany as any)).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] } }, data: { destinazioni: ["META", "BLOG"] },
    });
  });
  it("returns 400 on empty ids", async () => {
    const res = await PATCH(req({ ids: [], destinazioni: ["META"] }));
    expect(res.status).toBe(400);
  });
});
