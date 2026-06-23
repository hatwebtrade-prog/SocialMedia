import { describe, it, expect } from "vitest";
import { payloadSchemaFor } from "@/lib/meta/schema";

describe("payloadSchemaFor", () => {
  it("validates a POST payload", () => {
    const v = payloadSchemaFor("POST").parse({
      caption: "Caption di prova",
      ideaCreativa: "Foto del prodotto su sfondo naturale",
      hashtags: ["#magnesio", "#benessere"],
      cta: "Scopri di più",
    });
    expect(v.caption).toBe("Caption di prova");
  });

  it("requires 3-10 slides for CAROSELLO", () => {
    const schema = payloadSchemaFor("CAROSELLO");
    expect(() =>
      schema.parse({ caption: "c", ideaCreativa: "i", hashtags: [], cta: "x", slides: [{ testo: "a" }] }),
    ).toThrow();
    const ok = schema.parse({
      caption: "c", ideaCreativa: "i", hashtags: [], cta: "x",
      slides: [{ testo: "1" }, { testo: "2" }, { testo: "3" }],
    });
    expect(ok.slides).toHaveLength(3);
  });

  it("rejects a POST payload missing caption", () => {
    expect(() => payloadSchemaFor("POST").parse({ ideaCreativa: "i", hashtags: [], cta: "x" })).toThrow();
  });
});
