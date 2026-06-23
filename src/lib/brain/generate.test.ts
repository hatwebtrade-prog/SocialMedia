import { describe, it, expect, vi } from "vitest";
import { runBrainstorm } from "@/lib/brain/generate";

function makeDeps(overrides = {}) {
  const created = { runId: "run_1", ideaCount: 0 };
  return {
    loadKb: vi.fn().mockResolvedValue({ products: [], knowledge: [] }),
    loadExistingTitles: vi.fn().mockResolvedValue(["idea esistente"]),
    callClaude: vi.fn().mockResolvedValue({
      parsed: {
        ideas: [
          { titolo: "Idea esistente", descrizione: "d", category: "TREND", piattaformeConsigliate: ["TIKTOK"], seoScore: 3, viralityScore: 3, priority: 3, prodottoCollegato: null, motivazione: "m" },
          { titolo: "Idea nuova", descrizione: "d", category: "EDUCATIONAL", piattaformeConsigliate: ["BLOG"], seoScore: 4, viralityScore: 2, priority: 5, prodottoCollegato: "Magnesio", motivazione: "m" },
        ],
      },
      promptUsato: "PROMPT",
      modello: "claude-opus-4-8",
      inputTokens: 100,
      outputTokens: 200,
      rawOutput: { any: "thing" },
    }),
    persist: vi.fn().mockImplementation(async ({ ideas }) => {
      created.ideaCount = ideas.length;
      return { runId: created.runId, ideas };
    }),
    sourceKey: "ai-brainstorming",
    ...overrides,
  };
}

describe("runBrainstorm", () => {
  it("dedupes against existing titles before persisting", async () => {
    const deps = makeDeps();
    const result = await runBrainstorm({ count: 2 }, deps as any);
    expect(deps.persist).toHaveBeenCalledOnce();
    const persisted = (deps.persist as any).mock.calls[0][0].ideas;
    expect(persisted.map((i: any) => i.titolo)).toEqual(["Idea nuova"]);
    expect(result.created).toBe(1);
    expect(result.status).toBe("DONE");
    expect(result.runId).toBe("run_1");
    expect(deps.loadExistingTitles).toHaveBeenCalledOnce();
  });

  it("records an ERROR run when the Claude call throws and persists no ideas", async () => {
    const deps = makeDeps({
      callClaude: vi.fn().mockRejectedValue(new Error("API down")),
    });
    const result = await runBrainstorm({ count: 2 }, deps as any);
    expect(result.status).toBe("ERROR");
    expect(result.error).toContain("API down");
    const persisted = (deps.persist as any).mock.calls[0][0];
    expect(persisted.ideas).toHaveLength(0);
    expect(persisted.status).toBe("ERROR");
  });

  it("records an ERROR run when loadKb throws", async () => {
    const deps = makeDeps({ loadKb: vi.fn().mockRejectedValue(new Error("DB giù")) });
    const result = await runBrainstorm({ count: 2 }, deps as any);
    expect(result.status).toBe("ERROR");
    expect(result.error).toContain("DB giù");
    expect(deps.callClaude).not.toHaveBeenCalled();
    expect((deps.persist as any).mock.calls[0][0].status).toBe("ERROR");
  });

  it("preserves the original error when the ERROR-run persist also throws", async () => {
    const deps = makeDeps({
      callClaude: vi.fn().mockRejectedValue(new Error("API down")),
      persist: vi.fn().mockRejectedValue(new Error("Connection refused")),
    });
    const result = await runBrainstorm({ count: 2 }, deps as any);
    expect(result.status).toBe("ERROR");
    expect(result.error).toContain("API down"); // NOT "Connection refused"
  });
});
