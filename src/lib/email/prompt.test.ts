import { describe, it, expect } from "vitest";
import { buildEmailPrompt } from "@/lib/email/prompt";

const idea = { titolo: "Magnesio e stress", descrizione: "d", category: "EDUCATIONAL" };

describe("buildEmailPrompt", () => {
  it("PROMO includes the product catalog + JSON shape", () => {
    const p = buildEmailPrompt({ kbContext: "kb", idea, formato: "PROMO_EMAIL", prodotti: [{ handle: "mg", titolo: "Magnesio Supremo", url: "https://x/products/mg", categoria: "Integratori", metafields: { posologia: "1/die" }, imageUrl: null }] });
    expect(p).toContain("Magnesio Supremo");
    expect(p.toLowerCase()).toContain("vendita");
    expect(p.toLowerCase()).toContain("json");
  });
  it("NEWSLETTER has no catalog and asks for empty prodotti", () => {
    const p = buildEmailPrompt({ kbContext: "kb", idea, formato: "NEWSLETTER", prodotti: [] });
    expect(p).not.toContain("Catalogo prodotti");
    expect(p).toContain("oggetto");
  });
});
