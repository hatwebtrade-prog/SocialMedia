import { describe, it, expect } from "vitest";
import { buildArticleBodyHtml } from "@/lib/shopify/publish";

describe("buildArticleBodyHtml", () => {
  it("appends JSON-LD script when present", () => {
    const out = buildArticleBodyHtml("<p>ciao</p>", '{"@type":"Article"}');
    expect(out).toContain("<p>ciao</p>");
    expect(out).toContain('application/ld+json');
    expect(out).toContain('"@type":"Article"');
  });
  it("returns corpoHtml unchanged when no JSON-LD", () => {
    expect(buildArticleBodyHtml("<p>x</p>")).toBe("<p>x</p>");
  });
});
