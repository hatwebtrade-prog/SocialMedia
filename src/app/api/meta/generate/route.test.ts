import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/meta/generate/route";
import { __setDepsFactory } from "@/app/api/meta/generate/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/meta/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/meta/generate", () => {
  it("returns 200 with the content id on success", async () => {
    const spy = vi.fn().mockResolvedValue({ status: "DONE", contentId: "c1" });
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ ideaId: "i1", formato: "POST", piattaforme: ["INSTAGRAM"] }));
    expect(res.status).toBe(200);
    expect((await res.json()).contentId).toBe("c1");
  });

  it("returns 400 on invalid input", async () => {
    const res = await POST(req({ ideaId: "", formato: "POST", piattaforme: [] }));
    expect(res.status).toBe(400);
  });
});
