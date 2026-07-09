import { describe, it, expect } from "vitest";
import { toKbItems } from "@/lib/knowledge/items";

describe("toKbItems", () => {
  it("merges KnowledgeItems and ready file texts (capped)", () => {
    const items = [{ tipo: "BRAND_VOICE", titolo: "Voce", contenuto: "tono caldo" }];
    const files = [{ nome: "piano.pdf", testo: "x".repeat(5000) }];
    const out = toKbItems(items, files);
    expect(out[0]).toEqual({ tipo: "BRAND_VOICE", titolo: "Voce", contenuto: "tono caldo" });
    expect(out[1].tipo).toBe("DOCUMENTO");
    expect(out[1].titolo).toBe("piano.pdf");
    expect(out[1].contenuto.length).toBe(2000);
  });
  it("skips files with empty text", () => {
    expect(toKbItems([], [{ nome: "a", testo: null }, { nome: "b", testo: "  " }])).toEqual([]);
  });
});
