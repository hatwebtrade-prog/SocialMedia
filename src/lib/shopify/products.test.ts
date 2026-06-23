import { describe, it, expect } from "vitest";
import { normalizeProducts } from "@/lib/shopify/products";

describe("normalizeProducts", () => {
  it("maps GraphQL product edges + metafields to ShopProduct[]", () => {
    const raw = {
      data: { products: { edges: [
        { node: {
          handle: "magnesio-supremo", title: "Magnesio Supremo", productType: "Integratori",
          metafields: { edges: [
            { node: { key: "ingredienti_dettagliati", value: "Magnesio citrato" } },
            { node: { key: "posologia", value: "1 misurino/die" } },
          ] },
        } },
      ] } },
    };
    const out = normalizeProducts(raw, "https://agocap.it");
    expect(out).toHaveLength(1);
    expect(out[0].handle).toBe("magnesio-supremo");
    expect(out[0].titolo).toBe("Magnesio Supremo");
    expect(out[0].url).toBe("https://agocap.it/products/magnesio-supremo");
    expect(out[0].categoria).toBe("Integratori");
    expect(out[0].metafields.posologia).toBe("1 misurino/die");
  });
  it("returns [] for a malformed response", () => {
    expect(normalizeProducts({}, "https://x")).toEqual([]);
  });
});
