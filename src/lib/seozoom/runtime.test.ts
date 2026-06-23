import { describe, it, expect } from "vitest";
import { matchCandidate, enrichWithKd } from "@/lib/seozoom/runtime";

const cands = [
  { keyword: "Magnesio Sonno", volume: 1900, difficolta: 35, trend: "in crescita" },
  { keyword: "vitamina c", volume: 500, difficolta: 20, trend: "stabile" },
];

describe("matchCandidate", () => {
  it("matches case-insensitively/trimmed", () => {
    expect(matchCandidate(" magnesio sonno ", cands)?.volume).toBe(1900);
  });
  it("returns null when no candidate matches", () => {
    expect(matchCandidate("sconosciuta", cands)).toBeNull();
  });
});

describe("enrichWithKd", () => {
  const pool = [
    { keyword: "Magnesio Sonno", volume: 1900, difficolta: 50, trend: "stabile" },
    { keyword: "vitamina c", volume: 500, difficolta: 50, trend: "stabile" },
  ];
  it("replaces difficolta with real KD where present (case-insensitive)", () => {
    const kd = new Map<string, number>([["magnesio sonno", 30]]);
    const out = enrichWithKd(pool, kd);
    expect(out[0].difficolta).toBe(30);
    expect(out[1].difficolta).toBe(50);
  });
});
