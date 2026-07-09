import { describe, it, expect } from "vitest";
import { buildVideoPrompt } from "@/lib/video/video-prompt";

describe("buildVideoPrompt", () => {
  it("combines reel fields and adds a soft cinematic motion note", () => {
    const p = buildVideoPrompt({ hook: "Capelli più forti", scriptParlato: "Scopri la biotina", testoSchermo: ["3 benefici"] });
    expect(p).toContain("Capelli più forti");
    expect(p).toContain("Scopri la biotina");
    expect(p).toContain("3 benefici");
    expect(p.toLowerCase()).toContain("movimento di camera");
  });
  it("falls back to ideaCreativa and is never empty", () => {
    const p = buildVideoPrompt({ ideaCreativa: "prodotto in scena naturale" });
    expect(p).toContain("prodotto in scena naturale");
    expect(p.trim().length).toBeGreaterThan(0);
  });
});
