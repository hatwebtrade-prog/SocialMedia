import { describe, it, expect, vi } from "vitest";
import { publishBlogContent } from "@/lib/blog/publish";

function makeDeps(over = {}) {
  return {
    loadContent: vi.fn().mockResolvedValue({ titoloSeo: "T", corpoHtml: "<p>x</p>", jsonLd: '{"@type":"Article"}', imageBase64: "abc" }),
    publish: vi.fn().mockResolvedValue({ id: 99, handle: "t", url: "https://shop/blogs/news/t" }),
    persistSuccess: vi.fn().mockResolvedValue(undefined),
    persistError: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("publishBlogContent", () => {
  it("DONE → publishes and persists success with the article url", async () => {
    const deps = makeDeps();
    const res = await publishBlogContent({ contentId: "c1", blogId: 1, blogHandle: "news", published: false }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.shopifyArticleUrl).toBe("https://shop/blogs/news/t");
    expect((deps.publish as any).mock.calls[0][0].bodyHtml).toContain("application/ld+json");
    expect(deps.persistSuccess).toHaveBeenCalled();
  });
  it("ERROR → persists error when Shopify throws", async () => {
    const deps = makeDeps({ publish: vi.fn().mockRejectedValue(new Error("Shopify 422")) });
    const res = await publishBlogContent({ contentId: "c1", blogId: 1, blogHandle: "news", published: false }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persistError).toHaveBeenCalledWith("c1", expect.stringContaining("Shopify 422"));
    expect(deps.persistSuccess).not.toHaveBeenCalled();
  });
  it("ERROR when content not found", async () => {
    const deps = makeDeps({ loadContent: vi.fn().mockResolvedValue(null) });
    const res = await publishBlogContent({ contentId: "x", blogId: 1, blogHandle: "news", published: false }, deps as any);
    expect(res.status).toBe("ERROR");
  });
});
