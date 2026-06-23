import { describe, it, expect } from "vitest";
import { badgeStyle } from "@/components/status-badge";

describe("badgeStyle", () => {
  it("maps known states to a label + classes", () => {
    expect(badgeStyle("APPROVATA").label).toBe("Approvata");
    expect(badgeStyle("PUBBLICATO").className).toContain("green");
    expect(badgeStyle("ERRORE").className).toContain("red");
  });
  it("falls back for unknown states", () => {
    const b = badgeStyle("XYZ");
    expect(b.label).toBe("XYZ");
    expect(b.className).toBeTruthy();
  });
});
