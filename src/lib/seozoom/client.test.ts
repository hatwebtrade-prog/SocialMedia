import { describe, it, expect } from "vitest";
import { normalizeSeozoom } from "@/lib/seozoom/client";

describe("normalizeSeozoom", () => {
  it("maps SEOZoom rows to NormalizedKeyword with sensible defaults", () => {
    // Uses real SEOZoom API field names: search_volume, KD (verified from apidoc.seozoom.it)
    // No top-level "trend" field in the API — monthly breakdown only — so second row exercises default
    const raw = [
      { keyword: "magnesio sonno", search_volume: 1900, KD: 35, trend: "in crescita" },
      { keyword: "magnesio stress", search_volume: 880 },
    ];
    const out = normalizeSeozoom(raw);
    expect(out[0]).toEqual({ keyword: "magnesio sonno", volume: 1900, difficolta: 35, trend: "in crescita" });
    expect(out[1].keyword).toBe("magnesio stress");
    expect(out[1].volume).toBe(880);
    expect(out[1].difficolta).toBe(50);
    expect(out[1].trend).toBe("stabile");
  });

  it("ignores rows without a keyword string", () => {
    expect(normalizeSeozoom([{ search_volume: 100 }, null, { keyword: "ok", search_volume: 10 }])).toHaveLength(1);
  });
});
