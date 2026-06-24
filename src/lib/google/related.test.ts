import { describe, it, expect } from "vitest";
import { normalizeSuggest } from "@/lib/google/related";

describe("normalizeSuggest", () => {
  it("extracts the suggestions array (firefox client shape)", () => {
    const raw = ["magnesio", ["magnesio supremo", "magnesio citrato", "magnesio e potassio"]];
    expect(normalizeSuggest(raw)).toEqual(["magnesio supremo", "magnesio citrato", "magnesio e potassio"]);
  });
  it("returns [] for malformed input", () => {
    expect(normalizeSuggest({})).toEqual([]);
    expect(normalizeSuggest(["x"])).toEqual([]);
    expect(normalizeSuggest(["x", [1, "ok", null]])).toEqual(["ok"]);
  });
});
