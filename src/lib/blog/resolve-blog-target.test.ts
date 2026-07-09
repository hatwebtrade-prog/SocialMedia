import { describe, it, expect, afterEach } from "vitest";
import { resolveBlogTarget } from "./resolve-blog-target";

const BLOGS = [
  { id: 1, title: "News", handle: "news" },
  { id: 2, title: "Guide", handle: "guide" },
];

afterEach(() => {
  delete process.env.SHOPIFY_BLOG_HANDLE;
});

describe("resolveBlogTarget", () => {
  it("usa l'unico blog quando ce n'è uno solo", async () => {
    const t = await resolveBlogTarget({ list: async () => [BLOGS[0]] });
    expect(t).toEqual({ blogId: 1, blogHandle: "news" });
  });

  it("usa SHOPIFY_BLOG_HANDLE quando ci sono più blog", async () => {
    process.env.SHOPIFY_BLOG_HANDLE = "guide";
    const t = await resolveBlogTarget({ list: async () => BLOGS });
    expect(t).toEqual({ blogId: 2, blogHandle: "guide" });
  });

  it("errore chiaro se più blog e nessun handle configurato", async () => {
    await expect(resolveBlogTarget({ list: async () => BLOGS })).rejects.toThrow(/SHOPIFY_BLOG_HANDLE/);
  });

  it("errore se l'handle configurato non esiste", async () => {
    process.env.SHOPIFY_BLOG_HANDLE = "inesistente";
    await expect(resolveBlogTarget({ list: async () => BLOGS })).rejects.toThrow(/inesistente/);
  });

  it("errore se nessun blog", async () => {
    await expect(resolveBlogTarget({ list: async () => [] })).rejects.toThrow(/Nessun blog/);
  });
});
