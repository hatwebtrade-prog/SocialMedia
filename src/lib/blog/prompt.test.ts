import { describe, it, expect } from "vitest";
import { buildBlogPrompt } from "@/lib/blog/prompt";

describe("buildBlogPrompt", () => {
  it("includes KB, idea, products, seo keywords, GEO + JSON instructions", () => {
    const p = buildBlogPrompt({
      kbContext: "## Tono\nNaturale",
      idea: { keyword: "magnesio sonno", volumeRicerca: 1900, difficolta: 35, titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL" },
      prodotti: [{ handle: "magnesio-supremo", titolo: "Magnesio Supremo", url: "https://x/products/magnesio-supremo", categoria: "Integratori", metafields: { posologia: "1/die" }, imageUrl: null }],
      seo: { keywordPrincipale: "magnesio sonno", keywordSecondarie: ["magnesio stress"] },
    });
    expect(p).toContain("magnesio sonno");
    expect(p).toContain("Magnesio Supremo");
    expect(p).toContain("posologia");
    expect(p.toLowerCase()).toContain("faq");
    expect(p.toLowerCase()).toContain("json");
    expect(p.toLowerCase()).toContain("html");
  });
});
