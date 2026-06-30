import { describe, it, expect } from "vitest";
import { navItems, isActive } from "@/lib/nav/items";

describe("nav", () => {
  it("exposes the editorial areas", () => {
    const labels = navItems.map((a) => a.label);
    expect(labels).toContain("Home");
    expect(labels).toContain("Brain");
    expect(labels).toContain("Calendario");
  });
  it("nests Trend & SEO under Brain", () => {
    const brain = navItems.find((a) => a.label === "Brain");
    const childLabels = (brain?.children ?? []).map((c) => c.label);
    expect(childLabels).toContain("Trend & SEO");
  });
  it("isActive: Home only matches exact /", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/dashboard", "/")).toBe(false);
  });
  it("isActive: area matches its own path and sub-paths", () => {
    expect(isActive("/meta", "/meta")).toBe(true);
    expect(isActive("/meta/genera", "/meta")).toBe(true);
    expect(isActive("/blog", "/meta")).toBe(false);
  });
});
