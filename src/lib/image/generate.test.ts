import { describe, it, expect, vi } from "vitest";
import { generateImageAsset } from "@/lib/image/generate";

function makeDeps(overrides = {}) {
  return {
    loadContent: vi.fn().mockResolvedValue({ ideaCreativa: "concept", slideText: null }),
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
});
