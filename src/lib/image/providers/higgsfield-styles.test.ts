import { describe, it, expect } from "vitest";
import { normalizeSoulStyles } from "@/lib/image/providers/higgsfield";

describe("normalizeSoulStyles", () => {
  it("maps id/name/preview from array or {items}", () => {
    const raw = [{ id: "a", name: "Realistic", preview_url: "u1", description: "d" }];
    expect(normalizeSoulStyles(raw)).toEqual([{ id: "a", name: "Realistic", previewUrl: "u1" }]);
    expect(normalizeSoulStyles({ items: raw })).toEqual([{ id: "a", name: "Realistic", previewUrl: "u1" }]);
  });
  it("[] for malformed", () => { expect(normalizeSoulStyles(null)).toEqual([]); expect(normalizeSoulStyles({})).toEqual([]); });
});
