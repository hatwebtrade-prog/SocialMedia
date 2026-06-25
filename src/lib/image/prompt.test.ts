import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "@/lib/image/prompt";

describe("buildImagePrompt", () => {
  it("uses the creative idea as the scene", () => {
    const p = buildImagePrompt({ ideaCreativa: "Bottiglia di magnesio su tavolo di legno", slideText: null });
    expect(p).toContain("Bottiglia di magnesio su tavolo di legno");
  });

  it("pushes a single photorealistic photo", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: null }).toLowerCase();
    expect(p).toContain("iperrealistica");
    expect(p).toContain("singola");
  });

  it("forbids text and collage/slide layouts", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: null }).toLowerCase();
    expect(p).toContain("vietato");
    expect(p).toContain("collage");
  });

  it("uses slide copy only as a theme, stripping the 'Slide N:' prefix", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: "Slide 1: i benefici del magnesio" });
    expect(p).toContain("i benefici del magnesio");
    expect(p).not.toContain("Slide 1");
  });

  it("adds product-preservation guidance only when a mockup is used", () => {
    const withMockup = buildImagePrompt({ ideaCreativa: "concept", slideText: null, hasMockup: true });
    const without = buildImagePrompt({ ideaCreativa: "concept", slideText: null, hasMockup: false });
    expect(withMockup).toContain("IDENTICO");
    expect(without).not.toContain("IDENTICO");
  });
});
