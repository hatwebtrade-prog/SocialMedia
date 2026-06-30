import { describe, it, expect, vi } from "vitest";
import { publishMetaContent, type MetaPublishDeps, type MetaContentData } from "./publish";

const data = (over: Partial<MetaContentData> = {}): MetaContentData => ({
  postType: "image", caption: "Ciao", platforms: ["facebook", "instagram"],
  images: [{ bytes: Buffer.from("x"), url: "https://pub/a.png" }], ...over,
});
const baseDeps = (over: Partial<MetaPublishDeps> = {}): MetaPublishDeps => ({
  loadContent: async () => data(),
  publishFacebook: async () => ({ postId: "FB1" }),
  publishInstagram: async () => ({ postId: "IG1" }),
  persistSuccess: vi.fn(async () => {}),
  persistError: vi.fn(async () => {}),
  ...over,
});

describe("publishMetaContent", () => {
  it("contenuto inesistente -> ERROR", async () => {
    const r = await publishMetaContent({ contentId: "x" }, baseDeps({ loadContent: async () => null }));
    expect(r.status).toBe("ERROR");
  });
  it("pubblica su entrambe e salva i due id", async () => {
    const deps = baseDeps();
    const r = await publishMetaContent({ contentId: "c1" }, deps);
    expect(r).toMatchObject({ status: "DONE", facebookPostId: "FB1", instagramPostId: "IG1" });
    expect(deps.persistSuccess).toHaveBeenCalledWith("c1", { facebookPostId: "FB1", instagramPostId: "IG1" });
  });
  it("solo facebook quando platforms=['facebook']", async () => {
    const ig = vi.fn(async () => ({ postId: "IG" }));
    const deps = baseDeps({ loadContent: async () => data({ platforms: ["facebook"] }), publishInstagram: ig });
    const r = await publishMetaContent({ contentId: "c" }, deps);
    expect(r.facebookPostId).toBe("FB1");
    expect(ig).not.toHaveBeenCalled();
  });
  it("REEL -> ERROR senza chiamare le pubblicazioni", async () => {
    const fb = vi.fn(async () => ({ postId: "FB" }));
    const deps = baseDeps({ loadContent: async () => data({ postType: "reel" }), publishFacebook: fb });
    const r = await publishMetaContent({ contentId: "c" }, deps);
    expect(r.status).toBe("ERROR");
    expect(fb).not.toHaveBeenCalled();
  });
  it("IG fallisce ma FB riesce -> ERROR, salva comunque l'id FB", async () => {
    const deps = baseDeps({ publishInstagram: async () => { throw new Error("image_url non raggiungibile"); } });
    const r = await publishMetaContent({ contentId: "c1" }, deps);
    expect(r.status).toBe("ERROR");
    expect(r.facebookPostId).toBe("FB1");
    expect(deps.persistError).toHaveBeenCalledWith("c1", expect.stringContaining("instagram"), { facebookPostId: "FB1" });
  });
});
