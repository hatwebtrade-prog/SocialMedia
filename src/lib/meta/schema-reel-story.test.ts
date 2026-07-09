import { describe, it, expect } from "vitest";
import { reelPayloadSchema, storyPayloadSchema, payloadSchemaFor } from "@/lib/meta/schema";

describe("reel/story payloads", () => {
  it("reelPayloadSchema accepts a structured reel", () => {
    const v = reelPayloadSchema.parse({
      caption: "c", ideaCreativa: "i", hashtags: ["#x"], cta: "cta",
      hook: "Aggancio", scriptParlato: "parlato", testoSchermo: ["riga 1", "riga 2"],
    });
    expect(v.hook).toBe("Aggancio");
    expect(v.testoSchermo).toHaveLength(2);
  });
  it("reel rejects a missing hook", () => {
    expect(() => reelPayloadSchema.parse({ caption: "c", ideaCreativa: "i", hashtags: [], cta: "x", scriptParlato: "p", testoSchermo: [] })).toThrow();
  });
  it("storyPayloadSchema accepts a light story", () => {
    const v = storyPayloadSchema.parse({ ideaCreativa: "i", testo: "overlay", cta: "swipe" });
    expect(v.testo).toBe("overlay");
  });
  it("payloadSchemaFor returns the right schema per format", () => {
    expect(payloadSchemaFor("REEL")).toBe(reelPayloadSchema);
    expect(payloadSchemaFor("STORY")).toBe(storyPayloadSchema);
  });
});
