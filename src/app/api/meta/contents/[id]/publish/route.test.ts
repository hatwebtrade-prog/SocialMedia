import { describe, it, expect, afterEach } from "vitest";
import { POST } from "./route";
import { __setDepsFactory } from "./deps-registry";

afterEach(() => __setDepsFactory(() => ({})));

function req() {
  return new Request("http://t/api/meta/contents/c1/publish", { method: "POST" });
}
const ctx = { params: Promise.resolve({ id: "c1" }) };

describe("POST publish meta", () => {
  it("200 quando la pipeline ritorna DONE", async () => {
    __setDepsFactory(() => ({ __run: async () => ({ status: "DONE", facebookPostId: "FB" }) }));
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "DONE", facebookPostId: "FB" });
  });
  it("502 quando la pipeline ritorna ERROR", async () => {
    __setDepsFactory(() => ({ __run: async () => ({ status: "ERROR", error: "x" }) }));
    const res = await POST(req(), ctx);
    expect(res.status).toBe(502);
  });
});
