import { describe, it, expect } from "vitest";
import { deriveSecondaryKeywords } from "@/lib/blog/runtime";

describe("deriveSecondaryKeywords", () => {
  it("drops the principal keyword and caps the list", () => {
    const related = [
      { keyword: "magnesio sonno", volume: 1, difficolta: 1, trend: "stabile" },
      { keyword: "magnesio stress", volume: 1, difficolta: 1, trend: "stabile" },
      { keyword: "magnesio sport", volume: 1, difficolta: 1, trend: "stabile" },
    ];
    const out = deriveSecondaryKeywords("Magnesio Sonno", related, 2);
    expect(out).toEqual(["magnesio stress", "magnesio sport"]);
  });
});
