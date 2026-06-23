import { describe, it, expect } from "vitest";
import { normalizeTitle, dedupeIdeas } from "@/lib/brain/dedupe";

describe("normalizeTitle", () => {
  it("lowercases, trims, and collapses whitespace and punctuation", () => {
    expect(normalizeTitle("  Magnesio   per il Sonno! ")).toBe("magnesio per il sonno");
  });
});

describe("dedupeIdeas", () => {
  const draft = (titolo: string) => ({ titolo });

  it("removes candidates whose title matches an existing title", () => {
    const result = dedupeIdeas(
      [draft("Magnesio per il sonno"), draft("Vitamina C d'inverno")],
      ["magnesio per il sonno"],
    );
    expect(result.map((d) => d.titolo)).toEqual(["Vitamina C d'inverno"]);
  });

  it("removes duplicates within the candidate batch itself", () => {
    const result = dedupeIdeas(
      [draft("Magnesio per il sonno"), draft("magnesio  PER il   sonno!")],
      [],
    );
    expect(result).toHaveLength(1);
  });
});
