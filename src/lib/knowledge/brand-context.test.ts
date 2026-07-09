import { describe, it, expect } from "vitest";
import { buildBrandVisualContext } from "@/lib/knowledge/brand-context";

const profile = { palette: ["verde salvia", "bianco caldo"], stileFotografico: "UGC iphone, luce naturale", mood: "fresco e sano", elementiRicorrenti: "ingredienti naturali", daEvitare: "aspetto plasticoso, testo in immagine" };

describe("buildBrandVisualContext", () => {
  it("GPT: includes positives AND avoid", () => {
    const s = buildBrandVisualContext(profile, "GPT");
    expect(s).toContain("verde salvia");
    expect(s.toLowerCase()).toContain("evita");
    expect(s).toContain("plasticoso");
  });
  it("HIGGSFIELD: positives only, no avoid", () => {
    const s = buildBrandVisualContext(profile, "HIGGSFIELD");
    expect(s).toContain("verde salvia");
    expect(s.toLowerCase()).not.toContain("evita");
    expect(s).not.toContain("plasticoso");
  });
  it("empty profile → empty string", () => {
    expect(buildBrandVisualContext({ palette: [] }, "GPT")).toBe("");
  });
});
