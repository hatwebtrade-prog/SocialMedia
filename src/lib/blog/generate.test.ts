import { describe, it, expect, vi } from "vitest";
import { generateBlogArticle } from "@/lib/blog/generate";

const article = {
  keywordPrincipale: "magnesio sonno", keywordSecondarie: [], intentoRicerca: "info",
  titoloSeo: "Magnesio e sonno", metaDescription: "d", puntiChiave: ["x"],
  corpoHtml: "<p>x</p>", faq: [{ domanda: "Q", risposta: "A" }], cta: "c", prodotti: [],
};

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({
      idea: { keyword: "magnesio sonno", volumeRicerca: 1900, difficolta: 35, titolo: "T", descrizione: "d", category: "EDUCATIONAL" },
      kbContext: "kb", prodotti: [],
    }),
    loadSeoData: vi.fn().mockResolvedValue({ keywordPrincipale: "magnesio sonno", keywordSecondarie: [] }),
    callClaude: vi.fn().mockResolvedValue({ payload: article, promptUsato: "P", modello: "claude-opus-4-8", inputTokens: 1, outputTokens: 1, rawOutput: {} }),
    generateImage: vi.fn().mockResolvedValue({ bytes: Buffer.from("img"), prompt: "imgprompt" }),
    persist: vi.fn().mockResolvedValue({ contentId: "c1" }),
    ...overrides,
  };
}

describe("generateBlogArticle", () => {
  it("returns DONE and persists a payload that includes a JSON-LD string", async () => {
    const deps = makeDeps();
    const res = await generateBlogArticle({ ideaId: "i1" }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.contentId).toBe("c1");
    const persisted = (deps.persist as any).mock.calls[0][0].payload;
    expect(typeof persisted.jsonLd).toBe("string");
    expect(persisted.jsonLd).toContain("FAQPage");
    expect(persisted.titoloSeo).toBe("Magnesio e sonno");
    expect((deps.generateImage as any).mock.calls[0][0].titoloSeo).toBe("Magnesio e sonno");
  });

  it("returns ERROR when Claude fails (nothing persisted)", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("AI down")) });
    const res = await generateBlogArticle({ ideaId: "i1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("AI down");
    expect(deps.persist).not.toHaveBeenCalled();
  });
});
