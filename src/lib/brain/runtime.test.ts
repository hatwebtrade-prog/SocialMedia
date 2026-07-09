import { describe, it, expect } from "vitest";
import { linkProductId } from "@/lib/brain/runtime";

describe("linkProductId", () => {
  const products = [
    { id: "p1", nome: "Magnesio Supremo" },
    { id: "p2", nome: "Vitamina C" },
  ];

  it("matches a product by case-insensitive name", () => {
    expect(linkProductId("magnesio supremo", products)).toBe("p1");
  });

  it("returns null when no product matches or name is null", () => {
    expect(linkProductId(null, products)).toBeNull();
    expect(linkProductId("Sconosciuto", products)).toBeNull();
  });
});
