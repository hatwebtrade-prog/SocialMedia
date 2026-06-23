import { describe, it, expect, vi } from "vitest";
import { generateMetaContent } from "@/lib/meta/generate";

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({
      idea: { titolo: "T", descrizione: "D", category: "EDUCATIONAL" },
      kbContext: "kb",
    }),
    callClaude: vi.fn().mockResolvedValue({
      payload: { caption: "c", ideaCreativa: "i", hashtags: ["#x"], cta: "vai" },
      promptUsato: "P",
      modello: "claude-opus-4-8",
      inputTokens: 10,
      outputTokens: 20,
      rawOutput: { any: "thing" },
    }),
    persist: vi.fn().mockResolvedValue({ contentId: "content_1" }),
    ...overrides,
  };
}

describe("generateMetaContent", () => {
  it("returns DONE with the new content id on success", async () => {
    const deps = makeDeps();
    const res = await generateMetaContent(
      { ideaId: "idea_1", formato: "POST", piattaforme: ["INSTAGRAM"] },
      deps as any,
    );
    expect(res.status).toBe("DONE");
    expect(res.contentId).toBe("content_1");
    expect(deps.persist).toHaveBeenCalledOnce();
  });

  it("returns ERROR and persists nothing when Claude throws", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("API down")) });
    const res = await generateMetaContent(
      { ideaId: "idea_1", formato: "POST", piattaforme: ["INSTAGRAM"] },
      deps as any,
    );
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("API down");
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("returns ERROR when the idea is not approved (loadContext throws)", async () => {
    const deps = makeDeps({ loadContext: vi.fn().mockRejectedValue(new Error("Idea non approvata")) });
    const res = await generateMetaContent(
      { ideaId: "idea_1", formato: "POST", piattaforme: ["INSTAGRAM"] },
      deps as any,
    );
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("non approvata");
  });
});
