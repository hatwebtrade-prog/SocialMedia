import { describe, it, expect, vi } from "vitest";
import { trashBlogContent } from "@/lib/blog/trash";

function makeDeps(overrides = {}) {
  return {
    loadArticleRef: vi.fn().mockResolvedValue({ shopifyArticleId: "999" }),
    deleteShopifyArticle: vi.fn().mockResolvedValue({ ok: true, notFound: false }),
    persistTrashed: vi.fn().mockResolvedValue(undefined),
    persistError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("trashBlogContent", () => {
  it("returns ERROR when the content is not found", async () => {
    const deps = makeDeps({ loadArticleRef: vi.fn().mockResolvedValue(null) });
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.deleteShopifyArticle).not.toHaveBeenCalled();
    expect(deps.persistTrashed).not.toHaveBeenCalled();
  });

  it("deletes the Shopify article then trashes locally on the happy path", async () => {
    const deps = makeDeps();
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(deps.deleteShopifyArticle).toHaveBeenCalledWith("999");
    expect(deps.persistTrashed).toHaveBeenCalledWith("c1");
    expect(res.status).toBe("DONE");
  });

  it("does NOT trash locally when the Shopify delete throws a real error", async () => {
    const deps = makeDeps({ deleteShopifyArticle: vi.fn().mockRejectedValue(new Error("shopify down")) });
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("shopify down");
    expect(deps.persistError).toHaveBeenCalledWith("c1", expect.stringContaining("shopify down"));
    expect(deps.persistTrashed).not.toHaveBeenCalled();
  });

  it("trashes locally without calling Shopify when there is no shopifyArticleId", async () => {
    const deps = makeDeps({ loadArticleRef: vi.fn().mockResolvedValue({ shopifyArticleId: null }) });
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(deps.deleteShopifyArticle).not.toHaveBeenCalled();
    expect(deps.persistTrashed).toHaveBeenCalledWith("c1");
    expect(res.status).toBe("DONE");
  });
});
