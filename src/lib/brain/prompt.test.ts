import { describe, it, expect } from "vitest";
import { buildBrainstormPrompt } from "@/lib/brain/prompt";

describe("buildBrainstormPrompt", () => {
  it("embeds the KB context, the input parameters, and the editorial angles", () => {
    const prompt = buildBrainstormPrompt({
      kbContext: "## Prodotti Agocap\n- Magnesio Supremo",
      input: { prodotto: "Magnesio Supremo", categoria: "EDUCATIONAL", angolo: "soft selling", keywordSeed: "sonno", count: 5 },
    });
    expect(prompt).toContain("Magnesio Supremo");
    expect(prompt).toContain("soft selling");
    expect(prompt).toContain("sonno");
    expect(prompt).toContain("5");
    expect(prompt.toLowerCase()).toContain("educational");
    expect(prompt.toLowerCase()).toContain("stagionalità");
  });

  it("adds a destination-channel section when destinazioni are selected", () => {
    const prompt = buildBrainstormPrompt({
      kbContext: "## Prodotti Agocap",
      input: { destinazioni: ["TIKTOK", "META"], count: 3 },
    });
    expect(prompt).toContain("Canali di destinazione");
    expect(prompt).toContain("TikTok");
    expect(prompt).toContain("Instagram e Facebook");
    expect(prompt).toContain("piattaformeConsigliate");
  });

  it("omits the destination section when none are selected", () => {
    const prompt = buildBrainstormPrompt({
      kbContext: "## Prodotti Agocap",
      input: { count: 3 },
    });
    expect(prompt).not.toContain("Canali di destinazione");
  });
});
