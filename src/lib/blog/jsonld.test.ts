import { describe, it, expect } from "vitest";
import { buildArticleJsonLd } from "@/lib/blog/jsonld";

describe("buildArticleJsonLd", () => {
  it("builds Article + FAQPage JSON-LD as a JSON string", () => {
    const s = buildArticleJsonLd({
      titoloSeo: "Magnesio e sonno",
      metaDescription: "Guida al magnesio.",
      faq: [{ domanda: "Quando?", risposta: "La sera." }],
    });
    const parsed = JSON.parse(s);
    expect(Array.isArray(parsed["@graph"])).toBe(true);
    const types = parsed["@graph"].map((n: { ["@type"]: string }) => n["@type"]);
    expect(types).toContain("Article");
    expect(types).toContain("FAQPage");
    const faqNode = parsed["@graph"].find((n: { ["@type"]: string }) => n["@type"] === "FAQPage");
    expect(faqNode.mainEntity[0].name).toBe("Quando?");
    expect(faqNode.mainEntity[0].acceptedAnswer.text).toBe("La sera.");
  });
  it("emits an empty FAQPage mainEntity when there are no faq", () => {
    const parsed = JSON.parse(buildArticleJsonLd({ titoloSeo: "t", metaDescription: "d", faq: [] }));
    const faqNode = parsed["@graph"].find((n: { ["@type"]: string }) => n["@type"] === "FAQPage");
    expect(faqNode.mainEntity).toEqual([]);
  });
});
