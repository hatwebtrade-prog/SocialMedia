import { describe, it, expect } from "vitest";
import { normalizeProducts } from "@/lib/shopify/products";

describe("normalizeProducts", () => {
  it("maps GraphQL product edges + metafields to ShopProduct[]", () => {
    const raw = {
      data: { products: { edges: [
        { node: {
          handle: "magnesio-supremo", title: "Magnesio Supremo", productType: "Integratori",
          featuredImage: { url: "https://img/x.jpg" },
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
    expect(out[0].imageUrl).toBe("https://img/x.jpg");
  });
  it("returns [] for a malformed response", () => {
    expect(normalizeProducts({}, "https://x")).toEqual([]);
  });
  it("maps imageUrl to null when featuredImage is absent", () => {
    const raw = {
      data: { products: { edges: [
        { node: {
          handle: "no-image", title: "No Image", productType: "Test",
          metafields: { edges: [] },
        } },
      ] } },
    };
    const out = normalizeProducts(raw, "https://agocap.it");
    expect(out).toHaveLength(1);
    expect(out[0].imageUrl).toBeNull();
  });
  it("maps up to 3 gallery images", () => {
    const raw = {
      data: { products: { edges: [
        { node: {
          handle: "p", title: "P", productType: "T",
          featuredImage: { url: "https://img/f.jpg" },
          images: { edges: [ { node: { url: "https://img/1.jpg" } }, { node: { url: "https://img/2.jpg" } } ] },
          metafields: { edges: [] },
        } },
      ] } },
    };
    const out = normalizeProducts(raw, "https://agocap.it");
    expect(out[0].images).toEqual(["https://img/1.jpg", "https://img/2.jpg"]);
  });
  it("defaults images to [] when absent", () => {
    const raw = { data: { products: { edges: [ { node: { handle: "n", title: "N", productType: "T", metafields: { edges: [] } } } ] } } };
    expect(normalizeProducts(raw, "https://x")[0].images).toEqual([]);
  });
});
