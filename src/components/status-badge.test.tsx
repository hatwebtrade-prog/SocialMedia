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

describe("badgeStyle publication states", () => {
  it("maps technical publication states", () => {
    expect(badgeStyle("NON_INVIATO").label).toBe("Non inviato");
    expect(badgeStyle("INVIATO_A_N8N").label).toBe("Inviato a n8n");
    expect(badgeStyle("INVIATO_A_N8N").className).toContain("blue");
    expect(badgeStyle("IN_PUBBLICAZIONE").label).toBe("In pubblicazione");
  });
});
