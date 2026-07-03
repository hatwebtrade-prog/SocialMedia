import { describe, it, expect, vi } from "vitest";
import { generateImageAsset } from "@/lib/image/generate";

function makeDeps(overrides = {}) {
  return {
    loadContent: vi.fn().mockResolvedValue({ ideaCreativa: "concept", slideText: null }),
    loadMockup: vi.fn().mockResolvedValue(Buffer.from("mockbytes")),
    callOpenAI: vi.fn().mockResolvedValue(Buffer.from("fakepng")),
    persistAsset: vi.fn().mockResolvedValue({ assetId: "asset_1" }),
    dominantColor: vi.fn().mockResolvedValue("#c81478"),
    loadLogo: vi.fn().mockReturnValue(null),
    overlayLogo: vi.fn(async (b: Buffer) => b),
    resolveSocialCopy: vi.fn().mockResolvedValue({ titolo: "T", bullets: ["a"] }),
    loadSlideReference: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("generateImageAsset", () => {
  it("returns DONE with the asset id on success", async () => {
    const deps = makeDeps();
    const res = await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.assetId).toBe("asset_1");
    expect(deps.callOpenAI).toHaveBeenCalledOnce();
  });

  it("returns ERROR and persists nothing when OpenAI throws", async () => {
    const deps = makeDeps({ callOpenAI: vi.fn().mockRejectedValue(new Error("openai down")) });
    const res = await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("openai down");
    expect(deps.persistAsset).not.toHaveBeenCalled();
  });

  it("loads the mockup and passes it to OpenAI when useMockup", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null, productId: "p1", useMockup: true }, deps as any);
    expect(deps.loadMockup).toHaveBeenCalledWith("p1");
    expect((deps.callOpenAI as any).mock.calls[0][1]).toBeInstanceOf(Buffer);
  });

  it("does NOT load a mockup when no product is selected", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(deps.loadMockup).not.toHaveBeenCalled();
    expect((deps.callOpenAI as any).mock.calls[0][1]).toBeUndefined();
  });

  it("auto-attaches the product image for GPT even without useMockup (no invented product)", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "X" }) });
    await generateImageAsset({ contentId: "c1", slideIndex: null, productId: "p1" }, deps as any);
    expect(deps.loadMockup).toHaveBeenCalledWith("p1");
    expect((deps.callOpenAI as any).mock.calls[0][1]).toBeInstanceOf(Buffer);
  });

  it("does NOT auto-attach the mockup for Higgsfield without useMockup", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "X" }) });
    await generateImageAsset({ contentId: "c1", slideIndex: null, productId: "p1", provider: "HIGGSFIELD" }, deps as any);
    expect(deps.loadMockup).not.toHaveBeenCalled();
  });

  it("passes the chosen provider to callOpenAI", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null, provider: "GEMINI" }, deps as any);
    expect((deps.callOpenAI as any).mock.calls[0][2]).toBe("GEMINI");
  });

  it("uses the client-provided ideaCreativa as the prompt, overriding the persisted value", async () => {
    const deps = makeDeps(); // loadContent returns ideaCreativa "concept"
    await generateImageAsset({ contentId: "c1", slideIndex: null, ideaCreativa: "PROMPT MARKER" }, deps as any);
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).toContain("PROMPT MARKER");
    expect(prompt).not.toContain("concept");
  });

  it("builds an archetype prompt for GPT when product data is available", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "Capelli Plus" }) });
    await generateImageAsset(
      { contentId: "c1", slideIndex: null, productId: "p1", archetype: "PRODUCT_HERO" },
      deps as any,
    );
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).toContain("AGOCAP");
    expect(prompt).toContain("Capelli Plus");
    expect(prompt).toContain("white studio");
  });

  it("defaults to the ADV archetype when none is given", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "X" }) });
    await generateImageAsset({ contentId: "c1", slideIndex: null, productId: "p1" }, deps as any);
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).toContain("direct-response");
  });

  it("does NOT use the archetype builder for Higgsfield", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "X" }) });
    await generateImageAsset(
      { contentId: "c1", slideIndex: null, productId: "p1", provider: "HIGGSFIELD" },
      deps as any,
    );
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).not.toContain("Avoid:");
  });

  it("passes the OpenAI size derived from the brief formato", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null, brief: { formato: "verticale" } }, deps as any);
    const opts = (deps.callOpenAI as any).mock.calls[0][3];
    expect(opts.openaiSize).toBe("1024x1536");
  });

  it("uses the branded social template for Meta (social=true) and overlays the logo when requested", async () => {
    const logo = Buffer.from("logo");
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "Biotina" }), loadMockup: vi.fn().mockResolvedValue(Buffer.from("m")), loadLogo: vi.fn().mockReturnValue(logo), overlayLogo: vi.fn(async () => Buffer.from("withlogo")) });
    const res = await generateImageAsset({ contentId: "c1", slideIndex: 0, productId: "p1", social: true, includiLogo: true, influencer: false }, deps as any);
    expect(res.status).toBe("DONE");
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).toContain("AGOCAP");
    expect(deps.overlayLogo).toHaveBeenCalled();
    expect((deps.persistAsset as any).mock.calls[0][0].bytes.toString()).toBe("withlogo");
  });

  it("includes the AI copy in the social prompt when includiDescrizione is on", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "Biotina" }), loadMockup: vi.fn().mockResolvedValue(Buffer.from("m")), resolveSocialCopy: vi.fn().mockResolvedValue({ titolo: "TITOLO MARKER", bullets: ["b1"] }) });
    await generateImageAsset({ contentId: "c1", slideIndex: 0, productId: "p1", social: true, includiDescrizione: true }, deps as any);
    expect(deps.resolveSocialCopy).toHaveBeenCalled();
    expect((deps.callOpenAI as any).mock.calls[0][0]).toContain("TITOLO MARKER");
  });

  it("skips the logo overlay when no logo file exists", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "X" }), loadMockup: vi.fn().mockResolvedValue(Buffer.from("m")), loadLogo: vi.fn().mockReturnValue(null) });
    await generateImageAsset({ contentId: "c1", slideIndex: 0, productId: "p1", social: true, includiLogo: true }, deps as any);
    expect(deps.overlayLogo).not.toHaveBeenCalled();
  });

  it("uses slide 1 as the coherence reference for a secondary slide (social)", async () => {
    const ref = Buffer.from("slide1image");
    const deps = makeDeps({ loadSlideReference: vi.fn().mockResolvedValue(ref) });
    await generateImageAsset({ contentId: "c1", slideIndex: 2, social: true }, deps as any);
    expect(deps.loadSlideReference).toHaveBeenCalledWith("c1");
    // the reference image passed to the model is slide 1's image
    expect((deps.callOpenAI as any).mock.calls[0][1]).toBe(ref);
    expect((deps.callOpenAI as any).mock.calls[0][0]).toContain("RIFERIMENTO");
  });

  it("does NOT fetch a slide reference for the first slide/main image", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: 0, social: true }, deps as any);
    expect(deps.loadSlideReference).not.toHaveBeenCalled();
  });
});
