import { describe, it, expect } from "vitest";
import { buildImagePromptFromBrief, isBriefEmpty, briefDimensions } from "@/lib/image/brief";

const brief = { soggetto: "donna che tiene il prodotto", ambientazione: "cucina luminosa", luce: "luce naturale", inquadratura: "medio busto", mood: "autentico", tieneProdotto: true };

describe("buildImagePromptFromBrief", () => {
  it("GPT: rich prompt with negatives", () => {
    const p = buildImagePromptFromBrief(brief, { provider: "GPT" });
    expect(p).toContain("cucina luminosa");
    expect(p.toLowerCase()).toContain("iperrealistica");
    expect(p.toLowerCase()).toContain("vietato");
  });
  it("HIGGSFIELD: short, positive, no negatives, no style word", () => {
    const p = buildImagePromptFromBrief({ ...brief, stile: "STYLE-UUID" }, { provider: "HIGGSFIELD" });
    expect(p.toLowerCase()).not.toContain("vietato");
    expect(p.toLowerCase()).not.toContain("iperrealistica");
    expect(p).not.toContain("STYLE-UUID");
    expect(p).toContain("cucina luminosa");
  });
  it("falls back to ctx.fallback when brief empty", () => {
    const p = buildImagePromptFromBrief({}, { provider: "GPT", fallback: "bottiglia di magnesio" });
    expect(p).toContain("bottiglia di magnesio");
  });
});

describe("isBriefEmpty", () => {
  it("true for empty/undefined", () => { expect(isBriefEmpty()).toBe(true); expect(isBriefEmpty({})).toBe(true); });
  it("false when a field set", () => { expect(isBriefEmpty({ soggetto: "x" })).toBe(false); });
});

describe("briefDimensions", () => {
  it("maps formato", () => {
    expect(briefDimensions("verticale").soul).toBe("1152x2048");
    expect(briefDimensions("quadrato").soul).toBe("1536x1536");
    expect(briefDimensions(undefined).openaiSize).toBe("1024x1024");
  });
});

describe("buildImagePromptFromBrief brandVisual", () => {
  it("includes brandVisual context for both providers", () => {
    const g = buildImagePromptFromBrief({ soggetto: "x" }, { provider: "GPT", brandVisual: "Coerenza brand Agocap: palette verde." });
    expect(g).toContain("palette verde");
    const h = buildImagePromptFromBrief({ soggetto: "x" }, { provider: "HIGGSFIELD", brandVisual: "palette verde" });
    expect(h).toContain("palette verde");
  });
});
