import { describe, it, expect, vi } from "vitest";
import { generateVideoAsset } from "@/lib/video/generate";

function makeDeps(over = {}) {
  return {
    loadStartImage: vi.fn().mockResolvedValue(Buffer.from("img")),
    loadReel: vi.fn().mockResolvedValue({ hook: "H", scriptParlato: "S" }),
    callVideo: vi.fn().mockResolvedValue(Buffer.from("mp4")),
    persistVideo: vi.fn().mockResolvedValue({ assetId: "v1" }),
    ...over,
  };
}

describe("generateVideoAsset", () => {
  it("returns DONE and persists when the start image exists", async () => {
    const deps = makeDeps();
    const res = await generateVideoAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res).toEqual({ status: "DONE", assetId: "v1" });
    const promptArg = (deps.callVideo as any).mock.calls[0][1] as string;
    expect(promptArg).toContain("H");
  });
  it("returns ERROR and persists nothing when there is no start image", async () => {
    const deps = makeDeps({ loadStartImage: vi.fn().mockResolvedValue(null) });
    const res = await generateVideoAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persistVideo).not.toHaveBeenCalled();
  });
  it("returns ERROR when the provider throws", async () => {
    const deps = makeDeps({ callVideo: vi.fn().mockRejectedValue(new Error("hf down")) });
    const res = await generateVideoAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("hf down");
    expect(deps.persistVideo).not.toHaveBeenCalled();
  });
  it("uses the client-provided prompt when present", async () => {
    const deps = makeDeps();
    await generateVideoAsset({ contentId: "c1", slideIndex: null, prompt: "CUSTOM" }, deps as any);
    expect((deps.callVideo as any).mock.calls[0][1]).toBe("CUSTOM");
    expect(deps.loadReel).not.toHaveBeenCalled();
  });
});
