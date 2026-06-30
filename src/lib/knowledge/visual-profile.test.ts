import { describe, it, expect } from "vitest";
import { parseVisualProfile, editorialDirectionBlock } from "@/lib/knowledge/visual-profile";

describe("parseVisualProfile", () => {
  it("parses fenced JSON into a profile", () => {
    const raw = "```json\n{\"palette\":[\"verde salvia\"],\"stileFotografico\":\"UGC\",\"mood\":\"sano\",\"elementiRicorrenti\":\"natura\",\"daEvitare\":\"plastica\"}\n```";
    expect(parseVisualProfile(raw)).toEqual({ palette: ["verde salvia"], stileFotografico: "UGC", mood: "sano", elementiRicorrenti: "natura", daEvitare: "plastica" });
  });
  it("throws on invalid", () => { expect(() => parseVisualProfile("nope")).toThrow(); });
});

describe("editorialDirectionBlock", () => {
  it("returns empty string for null", () => {
    expect(editorialDirectionBlock(null)).toBe("");
  });
  it("returns empty string for empty object (no fields)", () => {
    expect(editorialDirectionBlock({})).toBe("");
  });
  it("includes DIREZIONE_EDITORIALE tag and present fields, omits missing ones", () => {
    const result = editorialDirectionBlock({ campagna: "Estate 2026", daEvitare: "sfondi scuri" });
    expect(result).toContain("[DIREZIONE_EDITORIALE]");
    expect(result).toContain("campagna: Estate 2026");
    expect(result).toContain("evita: sfondi scuri");
    expect(result).not.toContain("periodo");
    expect(result).not.toContain("temi");
  });
});
