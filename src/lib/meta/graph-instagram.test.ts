import { describe, it, expect, vi } from "vitest";
import { publishInstagram, type GraphConfig } from "./graph";

const cfg: GraphConfig = { apiVersion: "v20.0", pageId: "P", igAccountId: "IG", token: "T" };

function mockFetch(responses: unknown[]) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: unknown) => {
    calls.push(String(url));
    const b = responses.shift();
    return { ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) } as unknown as Response;
  });
  return { impl, calls };
}

describe("publishInstagram", () => {
  it("image -> create container + status FINISHED + publish", async () => {
    const { impl, calls } = mockFetch([{ id: "CONT" }, { status_code: "FINISHED" }, { id: "IG_POST" }]);
    const r = await publishInstagram(cfg, { postType: "image", caption: "x", images: [{ url: "https://pub/a.png" }] }, impl as unknown as typeof fetch);
    expect(r.postId).toBe("IG_POST");
    expect(calls[0]).toContain("/IG/media");
    expect(calls[calls.length - 1]).toContain("/IG/media_publish");
  });
  it("carousel -> N child + container CAROUSEL + publish", async () => {
    const { impl } = mockFetch([{ id: "c1" }, { id: "c2" }, { id: "CONT" }, { status_code: "FINISHED" }, { id: "IG_C" }]);
    const r = await publishInstagram(cfg, { postType: "carousel", caption: "c", images: [{ url: "https://pub/1.png" }, { url: "https://pub/2.png" }] }, impl as unknown as typeof fetch);
    expect(r.postId).toBe("IG_C");
  });
  it("senza url -> errore raggiungibilità", async () => {
    const { impl } = mockFetch([]);
    await expect(
      publishInstagram(cfg, { postType: "image", caption: "x", images: [{ bytes: Buffer.from("x") }] }, impl as unknown as typeof fetch),
    ).rejects.toThrow(/url/i);
  });
});
