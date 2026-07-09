import { describe, it, expect } from "vitest";
import { blogArticleSchema } from "@/lib/blog/schema";

const valid = {
  keywordPrincipale: "magnesio sonno",
  keywordSecondarie: ["magnesio stress"],
  intentoRicerca: "informazionale",
  titoloSeo: "Magnesio e sonno: guida",
  metaDescription: "Come il magnesio favorisce il sonno.",
  puntiChiave: ["punto 1"],
  corpoHtml: "<h2>Intro</h2><p>...</p>",
  faq: [{ domanda: "Quando assumerlo?", risposta: "La sera." }],
  cta: "Scopri Magnesio Supremo",
  prodotti: [{ handle: "magnesio-supremo", titolo: "Magnesio Supremo", url: "https://x/products/magnesio-supremo" }],
};

describe("blogArticleSchema", () => {
  it("accepts a valid article", () => {
    expect(blogArticleSchema.parse(valid).titoloSeo).toBe("Magnesio e sonno: guida");
  });
  it("rejects a malformed faq entry", () => {
    expect(() => blogArticleSchema.parse({ ...valid, faq: [{ domanda: "x" }] })).toThrow();
  });
});
