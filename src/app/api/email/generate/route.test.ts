import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/email/generate/route";
import { __setDepsFactory } from "@/app/api/email/generate/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/email/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/email/generate", () => {
  it("200 with contentId on success", async () => {
    __setDepsFactory(() => ({ __run: vi.fn().mockResolvedValue({ status: "DONE", contentId: "c1" }) }) as any);
    const res = await POST(req({ ideaId: "i1", formato: "NEWSLETTER" }));
    expect(res.status).toBe(200);
    expect((await res.json()).contentId).toBe("c1");
  });
  it("400 on invalid formato", async () => {
    const res = await POST(req({ ideaId: "i1", formato: "XYZ" }));
    expect(res.status).toBe(400);
  });
  it("502 on ERROR", async () => {
    __setDepsFactory(() => ({ __run: vi.fn().mockResolvedValue({ status: "ERROR", error: "x" }) }) as any);
    const res = await POST(req({ ideaId: "i1", formato: "PROMO_EMAIL" }));
    expect(res.status).toBe(502);
  });
});
