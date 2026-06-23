import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/blog/generate/route";
import { __setDepsFactory } from "@/app/api/blog/generate/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/blog/generate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/blog/generate", () => {
  it("returns 200 with contentId on success", async () => {
    const spy = vi.fn().mockResolvedValue({ status: "DONE", contentId: "c1" });
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ ideaId: "i1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).contentId).toBe("c1");
  });
  it("returns 400 on missing ideaId", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
  it("returns 502 when generation errors", async () => {
    __setDepsFactory(() => ({ __run: vi.fn().mockResolvedValue({ status: "ERROR", error: "x" }) }) as any);
    const res = await POST(req({ ideaId: "i1" }));
    expect(res.status).toBe(502);
  });
});
