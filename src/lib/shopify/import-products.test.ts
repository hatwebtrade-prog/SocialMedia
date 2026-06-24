import { describe, it, expect } from "vitest";
import { mapShopProductToProduct } from "@/lib/shopify/import-products";

describe("mapShopProductToProduct", () => {
  it("maps fields + enriches from metafields", () => {
    const out = mapShopProductToProduct({
      handle: "magnesio-supremo", titolo: "Magnesio Supremo", url: "https://x/products/magnesio-supremo",
      categoria: "Integratori",
      metafields: { descrizione_seo: "Integratore di magnesio", ingredienti_dettagliati: "Magnesio citrato" },
    });
    expect(out).toEqual({
      handle: "magnesio-supremo", nome: "Magnesio Supremo", categoria: "Integratori",
      url: "https://x/products/magnesio-supremo", descrizione: "Integratore di magnesio", ingredienti: "Magnesio citrato",
    });
  });
  it("uses null for missing categoria/metafields", () => {
    const out = mapShopProductToProduct({ handle: "x", titolo: "X", url: "u", categoria: "", metafields: {} });
    expect(out.categoria).toBeNull();
    expect(out.descrizione).toBeNull();
    expect(out.ingredienti).toBeNull();
  });
});
