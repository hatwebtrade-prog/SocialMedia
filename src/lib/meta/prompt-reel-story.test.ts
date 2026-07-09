import { describe, it, expect } from "vitest";
import { buildMetaPrompt } from "@/lib/meta/prompt";

const idea = { titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL" };

describe("buildMetaPrompt reel/story", () => {
  it("REEL prompt asks for hook/scriptParlato/testoSchermo", () => {
    const p = buildMetaPrompt({ kbContext: "kb", idea, formato: "REEL", piattaforme: ["INSTAGRAM"] });
    expect(p).toContain("hook");
    expect(p).toContain("scriptParlato");
    expect(p).toContain("testoSchermo");
    expect(p).toContain("REEL");
  });
  it("STORY prompt asks for testo overlay + ideaCreativa, JSON only", () => {
    const p = buildMetaPrompt({ kbContext: "kb", idea, formato: "STORY", piattaforme: ["FACEBOOK"] });
    expect(p).toContain("testo");
    expect(p).toContain("ideaCreativa");
    expect(p.toLowerCase()).toContain("json");
  });
});
