import { describe, it, expect } from "vitest";
import { parseVisualProfile } from "@/lib/knowledge/visual-profile";

describe("parseVisualProfile", () => {
  it("parses fenced JSON into a profile", () => {
    const raw = "```json\n{\"palette\":[\"verde salvia\"],\"stileFotografico\":\"UGC\",\"mood\":\"sano\",\"elementiRicorrenti\":\"natura\",\"daEvitare\":\"plastica\"}\n```";
    expect(parseVisualProfile(raw)).toEqual({ palette: ["verde salvia"], stileFotografico: "UGC", mood: "sano", elementiRicorrenti: "natura", daEvitare: "plastica" });
  });
  it("throws on invalid", () => { expect(() => parseVisualProfile("nope")).toThrow(); });
});
