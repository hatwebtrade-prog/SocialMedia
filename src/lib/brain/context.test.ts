import { describe, it, expect } from "vitest";
import { buildKbContext } from "@/lib/brain/context";

describe("buildKbContext", () => {
  it("renders products and knowledge items into a compact context block", () => {
    const ctx = buildKbContext({
      products: [
        { nome: "Magnesio Supremo", categoria: "INTEGRATORI", descrizione: "Polvere di magnesio", benefici: "Sonno, stress", ingredienti: null, target: "Adulti stressati", url: null },
      ],
      knowledge: [
        { tipo: "BRAND_VOICE", titolo: "Tono", contenuto: "Caldo, professionale, empatico." },
      ],
    });
    expect(ctx).toContain("Magnesio Supremo");
    expect(ctx).toContain("Sonno, stress");
    expect(ctx).toContain("Caldo, professionale, empatico.");
  });

  it("returns an explicit empty marker when there is no KB material", () => {
    const ctx = buildKbContext({ products: [], knowledge: [] });
    expect(ctx).toContain("Nessun materiale");
  });
});
