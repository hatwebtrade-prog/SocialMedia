import { describe, it, expect } from "vitest";
import { matchesText } from "@/lib/brain/search";

describe("matchesText", () => {
  const idea = { titolo: "Magnesio e sonno", keyword: "magnesio notte" };
  it("empty query matches", () => { expect(matchesText(idea, "")).toBe(true); });
  it("matches titolo or keyword, case-insensitive", () => {
    expect(matchesText(idea, "SONNO")).toBe(true);
    expect(matchesText(idea, "notte")).toBe(true);
    expect(matchesText(idea, "vitamina")).toBe(false);
  });
  it("handles null keyword", () => {
    expect(matchesText({ titolo: "X", keyword: null }, "x")).toBe(true);
  });
});
