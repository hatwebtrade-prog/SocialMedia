import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "@/lib/image/prompt";

describe("buildImagePrompt", () => {
  it("uses the creative idea (almost) verbatim as the prompt", () => {
    const p = buildImagePrompt({ ideaCreativa: "copertina con titolo 'Caduta capelli?'", slideText: null });
    expect(p).toContain("copertina con titolo 'Caduta capelli?'");
  });

  it("adds a short high-quality photographic note", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: null }).toLowerCase();
    expect(p).toContain("alta qualità");
  });

  it("does NOT forbid text/titles in the image (text is allowed)", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: null }).toLowerCase();
    expect(p).not.toContain("vietato");
  });

  it("includes slide copy, stripping the 'Slide N:' prefix", () => {
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
