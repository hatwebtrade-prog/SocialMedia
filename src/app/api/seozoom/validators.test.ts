import { describe, it, expect } from "vitest";
import { discoverInputSchema } from "@/app/api/seozoom/validators";

describe("discoverInputSchema", () => {
  it("accepts free seeds", () => {
    expect(discoverInputSchema.parse({ seeds: ["magnesio"] }).seeds).toEqual(["magnesio"]);
  });
  it("accepts a productId", () => {
    expect(discoverInputSchema.parse({ productId: "p1" }).productId).toBe("p1");
  });
  it("rejects when neither seeds nor product/categoria provided", () => {
    expect(() => discoverInputSchema.parse({})).toThrow();
  });
  it("bounds topN", () => {
    expect(() => discoverInputSchema.parse({ seeds: ["x"], topN: 999 })).toThrow();
  });
});
