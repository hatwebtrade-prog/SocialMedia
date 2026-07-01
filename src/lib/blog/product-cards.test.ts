import { describe, it, expect } from "vitest";
import { benefitsToBullets, buildProductCards } from "@/lib/blog/product-cards";

describe("benefitsToBullets", () => {
  it("splits on newlines/semicolons and trims, capping at 3", () => {
    expect(benefitsToBullets("Energia; Recupero\nSonno; Extra")).toEqual(["Energia", "Recupero", "Sonno"]);
  });
  it("returns [] for empty/nullish", () => {
    expect(benefitsToBullets("")).toEqual([]);
    expect(benefitsToBullets(null)).toEqual([]);
  });
});

describe("buildProductCards", () => {
  const shop = {
    "magnesio": { imageUrl: "https://cdn/mag.jpg", url: "https://s/products/magnesio" },
    "melatonina": { imageUrl: "https://cdn/mel.jpg", url: "https://s/products/melatonina" },
  };
  const main = { id: "1", nome: "Magnesio", descrizione: "desc mag", benefici: "A; B", handle: "magnesio", categoria: "sonno" };
  const related = [
    { id: "1", nome: "Magnesio", handle: "magnesio", categoria: "sonno" },
    { id: "2", nome: "Melatonina", descrizione: "desc mel", benefici: "C", handle: "melatonina", categoria: "sonno" },
  ];

  it("builds main and excludes it from related (by handle), mapping Shopify image/url", () => {
    const res = buildProductCards({ main, sameCategory: related, shopifyByHandle: shop });
    expect(res.main?.nome).toBe("Magnesio");
    expect(res.main?.imageUrl).toBe("https://cdn/mag.jpg");
    expect(res.main?.bullets).toEqual(["A", "B"]);
    expect(res.related.map((r) => r.nome)).toEqual(["Melatonina"]);
    expect(res.related[0].url).toBe("https://s/products/melatonina");
  });

  it("caps related at 3 and handles a null main", () => {
    const many = [2, 3, 4, 5].map((n) => ({ id: String(n), nome: `P${n}`, handle: `h${n}`, categoria: "sonno" }));
    const res = buildProductCards({ main: null, sameCategory: many, shopifyByHandle: {} });
    expect(res.main).toBeNull();
    expect(res.related).toHaveLength(3);
  });
});
