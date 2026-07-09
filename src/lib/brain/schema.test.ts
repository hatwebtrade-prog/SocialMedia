import { describe, it, expect } from "vitest";
import { brainstormOutputSchema } from "@/lib/brain/schema";

describe("brainstormOutputSchema", () => {
  it("accepts a valid batch of classified ideas", () => {
    const parsed = brainstormOutputSchema.parse({
      ideas: [
        {
          titolo: "Magnesio per il sonno",
          descrizione: "Come il magnesio aiuta il riposo notturno.",
          category: "EDUCATIONAL",
          piattaformeConsigliate: ["INSTAGRAM", "BLOG"],
          seoScore: 4,
          viralityScore: 3,
          priority: 5,
          prodottoCollegato: "Magnesio Supremo",
          motivazione: "Domanda frequente del target.",
        },
      ],
    });
    expect(parsed.ideas).toHaveLength(1);
    expect(parsed.ideas[0].category).toBe("EDUCATIONAL");
  });

  it("coerces an invalid category to EDUCATIONAL instead of failing the batch", () => {
    const parsed = brainstormOutputSchema.parse({
      ideas: [
        { titolo: "x", descrizione: "y", category: "BLOG", piattaformeConsigliate: ["INSTAGRAM"], seoScore: 3, viralityScore: 3, priority: 3, prodottoCollegato: null, motivazione: "z" },
      ],
    });
    expect(parsed.ideas[0].category).toBe("EDUCATIONAL");
  });

  it("drops invalid platforms and falls back to BLOG when none are valid", () => {
    const parsed = brainstormOutputSchema.parse({
      ideas: [
        { titolo: "x", descrizione: "y", category: "TREND", piattaformeConsigliate: ["NON_ESISTE"], seoScore: 3, viralityScore: 3, priority: 3, prodottoCollegato: null, motivazione: "z" },
      ],
    });
    expect(parsed.ideas[0].piattaformeConsigliate).toEqual(["BLOG"]);
  });

  it("clamps scores outside 1-5 via validation", () => {
    expect(() =>
      brainstormOutputSchema.parse({
        ideas: [
          { titolo: "x", descrizione: "y", category: "TREND", piattaformeConsigliate: ["TIKTOK"], seoScore: 9, viralityScore: 3, priority: 3, prodottoCollegato: null, motivazione: "z" },
        ],
      }),
    ).toThrow();
  });
});
