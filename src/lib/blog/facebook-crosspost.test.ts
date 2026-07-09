import { describe, it, expect, vi } from "vitest";
import { buildFacebookCaption, crossPostBlogToFacebook } from "./facebook-crosspost";

describe("buildFacebookCaption", () => {
  it("compone titolo + estratto + link", () => {
    const c = buildFacebookCaption({ title: "Titolo", excerpt: "Un estratto.", url: "https://x/a" });
    expect(c).toContain("Titolo");
    expect(c).toContain("Un estratto.");
    expect(c).toContain("https://x/a");
  });
  it("funziona senza estratto", () => {
    const c = buildFacebookCaption({ title: "Solo titolo", url: "https://x/a" });
    expect(c).toContain("Solo titolo");
    expect(c).toContain("https://x/a");
    expect(c.split("\n\n").length).toBe(2);
  });
});

describe("crossPostBlogToFacebook", () => {
  it("SKIP se l'articolo non ha url (non pubblicato)", async () => {
    const r = await crossPostBlogToFacebook("c1", { loadArticle: async () => null, publish: vi.fn() });
    expect(r.status).toBe("SKIP");
  });
  it("DONE e ritorna postId al successo", async () => {
    const publish = vi.fn().mockResolvedValue({ postId: "fb123" });
    const r = await crossPostBlogToFacebook("c1", {
      loadArticle: async () => ({ title: "T", url: "https://x/a", image: Buffer.from("x") }),
      publish,
    });
    expect(r.status).toBe("DONE");
    expect(r.postId).toBe("fb123");
    expect(publish).toHaveBeenCalledOnce();
  });
  it("ERROR (non lancia) se la pubblicazione FB fallisce", async () => {
    const r = await crossPostBlogToFacebook("c1", {
      loadArticle: async () => ({ title: "T", url: "https://x/a" }),
      publish: async () => { throw new Error("Graph 400"); },
    });
    expect(r.status).toBe("ERROR");
    expect(r.error).toContain("Graph 400");
  });
});
