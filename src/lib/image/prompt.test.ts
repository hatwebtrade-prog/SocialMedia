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
});
