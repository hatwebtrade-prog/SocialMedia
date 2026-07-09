import { describe, it, expect } from "vitest";
import { metricsToSeoScore } from "@/lib/seozoom/score";

describe("metricsToSeoScore", () => {
  it("high volume + low difficulty scores 5", () => {
    expect(metricsToSeoScore({ volume: 5000, difficolta: 10 })).toBe(5);
  });
  it("high volume + high difficulty is penalised", () => {
    expect(metricsToSeoScore({ volume: 5000, difficolta: 80 })).toBe(3);
  });
  it("low volume + high difficulty scores 1", () => {
    expect(metricsToSeoScore({ volume: 20, difficolta: 90 })).toBe(1);
  });
  it("clamps within 1-5", () => {
    const v = metricsToSeoScore({ volume: 0, difficolta: 100 });
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(5);
  });
});
