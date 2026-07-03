import { describe, it, expect } from "vitest";
import { socialCopySchema, buildSocialCopyPrompt } from "@/lib/image/social-copy";

describe("socialCopySchema", () => {
  it("accepts a title and up to 3 bullets", () => {
    const v = socialCopySchema.parse({ titolo: "Biotina", bullets: ["Capelli", "Pelle", "Unghie"] });
    expect(v.bullets).toHaveLength(3);
  });
  it("caps bullets at 3", () => {
    const v = socialCopySchema.parse({ titolo: "X", bullets: ["a", "b", "c", "d", "e"] });
    expect(v.bullets).toHaveLength(3);
  });
});

describe("buildSocialCopyPrompt", () => {
  it("asks for a short italian title and bullets and mentions the product", () => {
    const p = buildSocialCopyPrompt({ titoloIdea: "Biotina per capelli", testo: "benefici", productName: "Biotina Complex 360" });
    expect(p).toContain("Biotina Complex 360");
    expect(p.toLowerCase()).toContain("italiano");
    expect(p).toContain("titolo");
  });
});
