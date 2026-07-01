import { describe, it, expect } from "vitest";
import { scrubCompetitors, scrubBlogPayload } from "@/lib/blog/competitors";

describe("scrubCompetitors", () => {
  it("replaces the competitor name case-insensitively", () => {
    expect(scrubCompetitors("Prova Natural System oggi")).toBe("Prova un noto marchio concorrente oggi");
    expect(scrubCompetitors("prova natural system")).toBe("prova un noto marchio concorrente");
  });
  it("tolerates spacing/hyphen variants", () => {
    expect(scrubCompetitors("naturalsystem")).toBe("un noto marchio concorrente");
    expect(scrubCompetitors("natural-system")).toBe("un noto marchio concorrente");
    expect(scrubCompetitors("natural   system")).toBe("un noto marchio concorrente");
  });
  it("replaces multiple occurrences", () => {
    expect(scrubCompetitors("Natural System vs Natural System")).toBe("un noto marchio concorrente vs un noto marchio concorrente");
  });
  it("leaves the standalone word 'naturale' untouched", () => {
    expect(scrubCompetitors("un approccio naturale al benessere")).toBe("un approccio naturale al benessere");
  });
  it("returns empty text unchanged", () => {
    expect(scrubCompetitors("")).toBe("");
  });
});

describe("scrubBlogPayload", () => {
  it("scrubs all text fields including faq, leaving prodotti untouched", () => {
    const p = {
      titoloSeo: "Natural System o Agocap?",
      metaDescription: "Confronto con Natural System",
      corpoHtml: "<p>Meglio di natural system</p>",
      cta: "Batti Natural System",
      keywordPrincipale: "natural system",
      keywordSecondarie: ["natural system integratore"],
      puntiChiave: ["Natural System costa di piu"],
      faq: [{ domanda: "Meglio di Natural System?", risposta: "Si, meglio di natural-system." }],
      prodotti: [{ handle: "x", titolo: "X", url: "u" }],
    };
    const out = scrubBlogPayload(p);
    expect(out.titoloSeo).not.toMatch(/natural[\s-]*system/i);
    expect(out.metaDescription).not.toMatch(/natural[\s-]*system/i);
    expect(out.corpoHtml).toContain("un noto marchio concorrente");
    expect(out.cta).not.toMatch(/natural[\s-]*system/i);
    expect(out.keywordPrincipale).toBe("un noto marchio concorrente");
    expect(out.keywordSecondarie[0]).not.toMatch(/natural[\s-]*system/i);
    expect(out.puntiChiave[0]).toContain("un noto marchio concorrente");
    expect(out.faq[0].domanda).not.toMatch(/natural[\s-]*system/i);
    expect(out.faq[0].risposta).not.toMatch(/natural[\s-]*system/i);
    expect(out.prodotti).toEqual(p.prodotti);
  });
});
