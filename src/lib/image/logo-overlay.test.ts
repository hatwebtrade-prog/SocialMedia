import { describe, it, expect } from "vitest";
import { logoPlacement } from "@/lib/image/logo-overlay";

describe("logoPlacement", () => {
  it("places the logo top-right respecting width% and margin%", () => {
    // 1000x1000 image, logo 4:1 (ratio=4), width 16% => 160x40, margin 4% => 40
    const p = logoPlacement(1000, 1000, 4, { widthPct: 0.16, marginPct: 0.04 });
    expect(p.width).toBe(160);
    expect(p.height).toBe(40);
    expect(p.left).toBe(1000 - 160 - 40); // 800
    expect(p.top).toBe(40);
  });
  it("uses defaults (16% width, 4% margin) and never returns negative offsets", () => {
    const p = logoPlacement(100, 100, 10);
    expect(p.width).toBe(16);
    expect(p.height).toBe(2); // 16/10 rounded
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
  });
});
