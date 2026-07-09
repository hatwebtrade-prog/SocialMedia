import { describe, it, expect } from "vitest";
import { buildArchetypePrompt, clampHeadline } from "@/lib/image/archetypes";

const product = {
  nome: "Capelli Plus",
  descrizione: "Integratore per capelli con biotina. Rinforza dalla radice.",
  ingredienti: "biotina, zinco",
  categoria: "capelli",
};

describe("buildArchetypePrompt", () => {
  it("includes the product name and is in English", () => {
    const { full } = buildArchetypePrompt("ADV", { product, hasMockup: false });
    expect(full).toContain("Capelli Plus");
    expect(full).toContain("AGOCAP");
    expect(full).toContain("Instagram/Facebook");
  });

  it("puts the creative idea prominently in the prompt when provided", () => {
    const withIdea = buildArchetypePrompt("ADV", { product, hasMockup: false, ideaCreativa: "donna in spiaggia al tramonto" }).full;
    const without = buildArchetypePrompt("ADV", { product, hasMockup: false }).full;
    expect(withIdea).toContain("Creative concept to depict");
    expect(withIdea).toContain("donna in spiaggia al tramonto");
    expect(without).not.toContain("Creative concept to depict");
  });

  it("includes the mockup fidelity block only when hasMockup", () => {
    const withM = buildArchetypePrompt("ADV", { product, hasMockup: true }).full;
    const without = buildArchetypePrompt("ADV", { product, hasMockup: false }).full;
    expect(withM).toContain("EXACT packaging reference");
    expect(without).not.toContain("EXACT packaging reference");
    expect(without).toContain("never fabricate a");
  });

  it("always appends the Avoid block with key entries", () => {
    const { full, avoid } = buildArchetypePrompt("UGC", { product, hasMockup: true });
    expect(full).toContain("Avoid:");
    expect(avoid).toContain("warped packaging");
    expect(avoid).toContain("unreadable label");
    expect(avoid).toContain("extra fingers");
  });

  it("produces distinct scene/style keywords per archetype", () => {
    const ugc = buildArchetypePrompt("UGC", { product, hasMockup: false }).full;
    const adv = buildArchetypePrompt("ADV", { product, hasMockup: false }).full;
    const hero = buildArchetypePrompt("PRODUCT_HERO", { product, hasMockup: false }).full;
    expect(ugc).toContain("window light");
    expect(adv).toContain("direct-response");
    expect(hero).toContain("white studio");
  });

  it("adds no text by default", () => {
    const { full } = buildArchetypePrompt("PRODUCT_HERO", { product, hasMockup: false });
    expect(full).toContain("no text, letters, words or logos");
  });

  it("includes a short headline only for ADV", () => {
    const adv = buildArchetypePrompt("ADV", { product, hasMockup: false, headline: "Capelli piu forti" }).full;
    const ugc = buildArchetypePrompt("UGC", { product, hasMockup: false, headline: "Capelli piu forti" }).full;
    expect(adv).toContain('"Capelli piu forti"');
    expect(ugc).not.toContain("Capelli piu forti");
    expect(ugc).toContain("no text");
  });

  it("clamps a headline to 5 words", () => {
    expect(clampHeadline("uno due tre quattro cinque sette otto")).toBe("uno due tre quattro cinque");
    const adv = buildArchetypePrompt("ADV", { product, hasMockup: false, headline: "uno due tre quattro cinque otto" }).full;
    expect(adv).toContain('"uno due tre quattro cinque"');
    expect(adv).not.toContain("otto");
  });

  it("maps the format label and uses the archetype default when absent", () => {
    const def = buildArchetypePrompt("UGC", { product, hasMockup: false }).full;
    expect(def).toContain("vertical 2:3");
    const sq = buildArchetypePrompt("UGC", { product, hasMockup: false, formato: "quadrato" }).full;
    expect(sq).toContain("square 1:1");
  });

  it("appends brief overrides and ignores empty ones", () => {
    const { full } = buildArchetypePrompt("ADV", {
      product,
      hasMockup: false,
      brief: { ambientazione: "seaside at sunset", luce: "" },
    });
    expect(full).toContain("seaside at sunset");
  });

  it("lists ingredients for PRODUCT_HERO", () => {
    const { full } = buildArchetypePrompt("PRODUCT_HERO", { product, hasMockup: false });
    expect(full).toContain("biotina, zinco");
  });

  it("includes the brand visual guidelines only when provided", () => {
    const withBrand = buildArchetypePrompt("ADV", { product, hasMockup: false, brandVisual: "warm terracotta palette, film grain" }).full;
    const without = buildArchetypePrompt("ADV", { product, hasMockup: false }).full;
    expect(withBrand).toContain("warm terracotta palette, film grain");
    expect(without).not.toContain("Brand visual style");
  });
});
