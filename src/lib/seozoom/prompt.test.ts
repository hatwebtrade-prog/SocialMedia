import { describe, it, expect } from "vitest";
import { buildShapingPrompt } from "@/lib/seozoom/prompt";

describe("buildShapingPrompt", () => {
  it("includes candidates, KB, and asks to echo the keyword", () => {
    const p = buildShapingPrompt({
      kbContext: "## Prodotti Agocap\n- Magnesio Supremo",
      prodottoNome: "Magnesio Supremo",
      candidates: [
        { keyword: "magnesio sonno", volume: 1900, difficolta: 35, trend: "in crescita" },
        { keyword: "magnesio stress", volume: 880, difficolta: 40, trend: "stabile" },
      ],
    });
    expect(p).toContain("magnesio sonno");
    expect(p).toContain("1900");
    expect(p).toContain("Magnesio Supremo");
    expect(p.toLowerCase()).toContain("keyword");
    expect(p.toLowerCase()).toContain("json");
  });
});
