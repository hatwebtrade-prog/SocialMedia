import { describe, it, expect } from "vitest";
import { buildSocialTemplatePrompt } from "@/lib/image/social-template";

const base = { productName: "Biotina Complex 360", hasMockup: true } as const;

describe("buildSocialTemplatePrompt", () => {
  it("adds a real person only when influencer is true", () => {
    const withInf = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: true });
    const without = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false });
    expect(withInf).toContain("influencer");
    expect(without).not.toContain("influencer");
    expect(without.toLowerCase()).toContain("nessuna persona");
  });
  it("uses the accent colour when provided", () => {
    const p = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false, accentHex: "#c81478" });
    expect(p).toContain("#c81478");
  });
  it("renders the copy title/bullets when provided, else forbids text", () => {
    const withCopy = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false, copy: { titolo: "3 Peculiarità", bullets: ["Capelli", "Pelle"] } });
    expect(withCopy).toContain("3 Peculiarità");
    expect(withCopy).toContain("Capelli");
    const noCopy = buildSocialTemplatePrompt({ ...base, variant: "SECONDARY", influencer: false });
    expect(noCopy.toLowerCase()).toContain("nessun testo");
  });
  it("MAIN is richer than SECONDARY", () => {
    const main = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false });
    const sec = buildSocialTemplatePrompt({ ...base, variant: "SECONDARY", influencer: false });
    expect(main).toContain("titolo grande");
    expect(sec).toContain("sobria");
  });
  it("always forbids collage and fake brands", () => {
    const p = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false });
    expect(p.toLowerCase()).toContain("non un collage");
    expect(p.toLowerCase()).toContain("nessun logo inventato");
  });
});
