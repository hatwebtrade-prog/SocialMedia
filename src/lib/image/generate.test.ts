import { describe, it, expect, vi } from "vitest";
import { generateImageAsset } from "@/lib/image/generate";

function makeDeps(overrides = {}) {
  return {
    loadContent: vi.fn().mockResolvedValue({ ideaCreativa: "concept", slideText: null }),
    loadMockup: vi.fn().mockResolvedValue(Buffer.from("mockbytes")),
    callOpenAI: vi.fn().mockResolvedValue(Buffer.from("fakepng")),
    persistAsset: vi.fn().mockResolvedValue({ assetId: "asset_1" }),
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

  it("does NOT load a mockup when useMockup is false/absent", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(deps.loadMockup).not.toHaveBeenCalled();
    expect((deps.callOpenAI as any).mock.calls[0][1]).toBeUndefined();
  });

  it("passes the chosen provider to callOpenAI", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null, provider: "GEMINI" }, deps as any);
    expect((deps.callOpenAI as any).mock.calls[0][2]).toBe("GEMINI");
  });

  it("passes openaiSize=1024x1536 to callOpenAI when formato is verticale", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null, brief: { formato: "verticale" } }, deps as any);
    const opts = (deps.callOpenAI as any).mock.calls[0][3];
    expect(opts.openaiSize).toBe("1024x1536");
  });

  it("passes openaiSize=1024x1024 to callOpenAI when no brief is provided", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    const opts = (deps.callOpenAI as any).mock.calls[0][3];
    expect(opts.openaiSize).toBe("1024x1024");
  });
});
