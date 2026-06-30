import { describe, it, expect, vi } from "vitest";
import { publishFacebook, type GraphConfig } from "./graph";

const cfg: GraphConfig = { apiVersion: "v20.0", pageId: "P", igAccountId: "IG", token: "T" };

function mockFetch(responses: unknown[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    const body = responses.shift();
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
  });
  return { impl, calls };
}

describe("publishFacebook", () => {
  it("text -> POST /{page}/feed con message", async () => {
    const { impl, calls } = mockFetch([{ id: "PAGE_123" }]);
    const r = await publishFacebook(cfg, { postType: "text", caption: "Ciao", images: [] }, impl as unknown as typeof fetch);
    expect(r.postId).toBe("PAGE_123");
    expect(calls[0].url).toContain("/P/feed");
  });
  it("image -> POST /{page}/photos (multipart) ritorna post_id", async () => {
    const { impl, calls } = mockFetch([{ id: "PH", post_id: "PAGE_456" }]);
    const r = await publishFacebook(cfg, { postType: "image", caption: "x", images: [{ bytes: Buffer.from("img") }] }, impl as unknown as typeof fetch);
    expect(r.postId).toBe("PAGE_456");
    expect(calls[0].url).toContain("/P/photos");
  });
  it("carousel -> N foto unpublished + feed con attached_media", async () => {
    const { impl, calls } = mockFetch([{ id: "1" }, { id: "2" }, { id: "POST_C" }]);
    const r = await publishFacebook(cfg, { postType: "carousel", caption: "c", images: [{ bytes: Buffer.from("a") }, { bytes: Buffer.from("b") }] }, impl as unknown as typeof fetch);
    expect(r.postId).toBe("POST_C");
    expect(calls.length).toBe(3);
    expect(calls[2].url).toContain("/P/feed");
  });
});
