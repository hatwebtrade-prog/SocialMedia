import { describe, it, expect } from "vitest";
import { shapingOutputSchema } from "@/lib/seozoom/schema";

describe("shapingOutputSchema", () => {
  it("accepts shaped ideas with keyword + classification", () => {
    const v = shapingOutputSchema.parse({
      ideas: [
        { keyword: "magnesio sonno", titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL", piattaformeConsigliate: ["BLOG"], motivazione: "m" },
      ],
    });
    expect(v.ideas[0].keyword).toBe("magnesio sonno");
  });
  it("rejects an invalid category", () => {
    expect(() => shapingOutputSchema.parse({ ideas: [{ keyword: "k", titolo: "t", descrizione: "d", category: "ZZZ", piattaformeConsigliate: ["BLOG"], motivazione: "m" }] })).toThrow();
  });
});
