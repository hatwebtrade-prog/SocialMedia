import { describe, it, expect } from "vitest";
import { estimatedProgress } from "@/lib/ui/progress";

describe("estimatedProgress", () => {
  it("starts low, caps at 92, never below 2", () => {
    expect(estimatedProgress(0, 60000).pct).toBe(2);
    expect(estimatedProgress(30000, 60000).pct).toBeCloseTo(50, 0);
    expect(estimatedProgress(999999, 60000).pct).toBe(92);
  });
  it("computes remaining seconds (floored at 0)", () => {
    expect(estimatedProgress(0, 60000).remainingSec).toBe(60);
    expect(estimatedProgress(60000, 60000).remainingSec).toBe(0);
    expect(estimatedProgress(999999, 60000).remainingSec).toBe(0);
  });
});
