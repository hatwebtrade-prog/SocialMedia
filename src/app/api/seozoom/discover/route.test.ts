import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/seozoom/discover/route";
import { __setDepsFactory } from "@/app/api/seozoom/discover/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/seozoom/discover", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/seozoom/discover", () => {
  it("returns 200 with created count on success", async () => {
    const spy = vi.fn().mockResolvedValue({ status: "DONE", created: 5, runId: "r1" });
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ seeds: ["magnesio"] }));
    expect(res.status).toBe(200);
    expect((await res.json()).created).toBe(5);
  });

  it("returns 400 when neither seeds nor product/categoria", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
