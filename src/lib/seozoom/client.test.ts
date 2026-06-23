import { describe, it, expect } from "vitest";
import { normalizeSeozoom, normalizeMetrics } from "@/lib/seozoom/client";

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

describe("normalizeMetrics", () => {
  it("maps metrics rows to a keyword→KD map (lowercased keys)", () => {
    const m = normalizeMetrics([
      { keyword: "Magnesio Sonno", KD: 42 },
      { keyword: "vitamina c", difficulty: 70 },
    ]);
    expect(m.get("magnesio sonno")).toBe(42);
    expect(m.get("vitamina c")).toBe(70);
  });
  it("skips rows without a keyword or without a numeric KD", () => {
    const m = normalizeMetrics([{ keyword: "x" }, { KD: 5 }, null]);
    expect(m.size).toBe(0);
  });
});
