import { describe, it, expect } from "vitest";
import { buildMetaPrompt } from "@/lib/meta/prompt";

describe("buildMetaPrompt", () => {
  it("includes the idea, KB context, platforms, and POST fields", () => {
    const p = buildMetaPrompt({
      kbContext: "## Prodotti Agocap\n- Magnesio Supremo",
      idea: { titolo: "Magnesio e sonno", descrizione: "Educational sul magnesio", category: "EDUCATIONAL" },
      formato: "POST",
      piattaforme: ["INSTAGRAM"],
    });
    expect(p).toContain("Magnesio e sonno");
    expect(p).toContain("Magnesio Supremo");
    expect(p.toLowerCase()).toContain("instagram");
    expect(p.toLowerCase()).toContain("caption");
  });

  it("asks for the requested number of slides for CAROSELLO", () => {
    const p = buildMetaPrompt({
      kbContext: "x",
      idea: { titolo: "t", descrizione: "d", category: "BEAUTY" },
      formato: "CAROSELLO",
      piattaforme: ["INSTAGRAM", "FACEBOOK"],
      numeroSlide: 6,
    });
    expect(p.toLowerCase()).toContain("slide");
    expect(p).toContain("6");
  });
});
