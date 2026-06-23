import { describe, it, expect } from "vitest";
import { matchCandidate } from "@/lib/seozoom/runtime";

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
