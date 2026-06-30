import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    editorialDirection: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

import { PUT } from "@/app/api/knowledge/editorial-direction/route";

describe("PUT /api/knowledge/editorial-direction", () => {
  it("returns 400 on malformed JSON body", async () => {
    const req = new Request("http://test/api/knowledge/editorial-direction", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{bad json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Input non valido");
  });
});
