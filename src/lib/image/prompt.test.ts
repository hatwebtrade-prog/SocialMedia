import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "@/lib/image/prompt";

describe("buildImagePrompt", () => {
  it("uses the creative idea and adds a brand style suffix", () => {
    const p = buildImagePrompt({ ideaCreativa: "Bottiglia di magnesio su tavolo di legno", slideText: null });
    expect(p).toContain("Bottiglia di magnesio su tavolo di legno");
    expect(p.toLowerCase()).toContain("agocap");
  });
  it("incorporates slide text when provided", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: "Slide 1: i benefici" });
    expect(p).toContain("Slide 1: i benefici");
  });

  it("pushes photorealism", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: null }).toLowerCase();
    expect(p).toContain("iperrealistica");
  });

  it("adds product-preservation guidance only when a mockup is used", () => {
    const withMockup = buildImagePrompt({ ideaCreativa: "concept", slideText: null, hasMockup: true });
    const without = buildImagePrompt({ ideaCreativa: "concept", slideText: null, hasMockup: false });
    expect(withMockup).toContain("IDENTICO");
    expect(without).not.toContain("IDENTICO");
  });
});
