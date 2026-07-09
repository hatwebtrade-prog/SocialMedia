import { describe, it, expect } from "vitest";
import { selectCandidates } from "@/lib/seozoom/select";

const kw = (keyword: string, volume: number, difficolta: number, trend = "stabile") => ({ keyword, volume, difficolta, trend });

describe("selectCandidates", () => {
  it("drops zero-volume keywords", () => {
    const r = selectCandidates([kw("a", 0, 10), kw("b", 100, 10)], { topN: 10 });
    expect(r.map((k) => k.keyword)).toEqual(["b"]);
  });

  it("ranks high-volume/low-difficulty first", () => {
    const r = selectCandidates([kw("low", 100, 80), kw("good", 2000, 20)], { topN: 10 });
    expect(r[0].keyword).toBe("good");
  });

  it("gives rising trends a bonus over equal stable ones", () => {
    const r = selectCandidates([kw("stable", 1000, 30, "stabile"), kw("rising", 1000, 30, "in crescita")], { topN: 10 });
    expect(r[0].keyword).toBe("rising");
  });

  it("caps to topN", () => {
    const many = Array.from({ length: 20 }, (_, i) => kw(`k${i}`, 1000 - i, 10));
    expect(selectCandidates(many, { topN: 5 })).toHaveLength(5);
  });
});
