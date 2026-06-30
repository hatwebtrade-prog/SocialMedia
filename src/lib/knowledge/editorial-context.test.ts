import { describe, it, expect } from "vitest";
import { buildEditorialImageContext } from "@/lib/knowledge/editorial-context";

const d = { campagna: "Estate 2026", daEvitare: "sfondi scuri" };

describe("buildEditorialImageContext", () => {
  it("GPT: includes positives and avoid", () => {
    const s = buildEditorialImageContext(d, "", "GPT");
    expect(s).toContain("Direzione editoriale Agocap: campagna Estate 2026.");
    expect(s).toContain(" Evita: sfondi scuri.");
  });

  it("HIGGSFIELD: positives only, no avoid", () => {
    const s = buildEditorialImageContext(d, "", "HIGGSFIELD");
    expect(s).toContain("campagna Estate 2026");
    expect(s).not.toContain("Evita");
  });

  it("HIGGSFIELD: plan text is capped at 200 chars", () => {
    const planTexts = "x".repeat(500);
    const s = buildEditorialImageContext({ campagna: "Test" }, planTexts, "HIGGSFIELD");
    // Count how many 'x' characters appear in the output
    const xCount = (s.match(/x/g) ?? []).length;
    expect(xCount).toBeLessThanOrEqual(200);
  });

  it("all empty → empty string for GPT", () => {
    expect(buildEditorialImageContext({}, "", "GPT")).toBe("");
  });
});
