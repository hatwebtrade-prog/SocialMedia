import { describe, it, expect, vi } from "vitest";
import { discoverKeywords } from "@/lib/seozoom/discover";

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({ seeds: ["magnesio"], kbContext: "kb", prodottoNome: undefined }),
    fetchKeywords: vi.fn().mockResolvedValue([
      { keyword: "magnesio sonno", volume: 1900, difficolta: 35, trend: "in crescita" },
      { keyword: "magnesio stress", volume: 880, difficolta: 40, trend: "stabile" },
    ]),
    callClaude: vi.fn().mockResolvedValue({
      ideas: [
        { keyword: "magnesio sonno", titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL", piattaformeConsigliate: ["BLOG"], motivazione: "m" },
      ],
      promptUsato: "P", modello: "claude-opus-4-8", inputTokens: 10, outputTokens: 20, rawOutput: {},
    }),
    persist: vi.fn().mockResolvedValue({ runId: "run_1", created: 1 }),
    recordError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("discoverKeywords", () => {
  it("returns DONE with the created count on success", async () => {
    const deps = makeDeps();
    const res = await discoverKeywords({ seeds: ["magnesio"] }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.created).toBe(1);
    const args = (deps.persist as any).mock.calls[0][0];
    expect(args.candidates.length).toBeGreaterThan(0);
    expect(args.claudeResult.ideas).toHaveLength(1);
    expect(deps.recordError).not.toHaveBeenCalled();
  });

  it("records an ERROR run and persists nothing when SEOZoom returns no keywords", async () => {
    const deps = makeDeps({ fetchKeywords: vi.fn().mockResolvedValue([]) });
    const res = await discoverKeywords({ seeds: ["xyz"] }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persist).not.toHaveBeenCalled();
    expect(deps.recordError).toHaveBeenCalledOnce();
  });

  it("records an ERROR run when Claude throws", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("API down")) });
    const res = await discoverKeywords({ seeds: ["magnesio"] }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("API down");
    expect(deps.recordError).toHaveBeenCalledOnce();
  });

  it("preserves the original error if recordError also throws", async () => {
    const deps = makeDeps({
      callClaude: vi.fn().mockRejectedValue(new Error("API down")),
      recordError: vi.fn().mockRejectedValue(new Error("DB giù")),
    });
    const res = await discoverKeywords({ seeds: ["magnesio"] }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("API down");
  });
});
