import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { __setDepsFactory } from "@/app/api/generate/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  it("returns 200 with the run summary on success", async () => {
    const spy = vi.fn().mockResolvedValue({ status: "DONE", created: 3, runId: "run_1" });
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ count: 3 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toBe(3);
  });

  it("returns 400 when count is missing or invalid", async () => {
    const res = await POST(req({ count: 0 }));
    expect(res.status).toBe(400);
  });
});
