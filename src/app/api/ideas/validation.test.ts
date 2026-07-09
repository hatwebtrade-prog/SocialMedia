import { describe, it, expect } from "vitest";
import { manualIdeaSchema, bulkStatusSchema } from "@/app/api/ideas/validators";

describe("manualIdeaSchema", () => {
  it("accepts a minimal valid manual idea", () => {
    const v = manualIdeaSchema.parse({ titolo: "Idea", category: "TREND", piattaformeConsigliate: ["TIKTOK"] });
    expect(v.seoScore).toBe(3);
    expect(v.status).toBe("NUOVA");
  });
  it("rejects an unknown category", () => {
    expect(() => manualIdeaSchema.parse({ titolo: "x", category: "ZZZ", piattaformeConsigliate: [] })).toThrow();
  });
});

describe("bulkStatusSchema", () => {
  it("requires at least one id and a valid status", () => {
    expect(() => bulkStatusSchema.parse({ ids: [], status: "APPROVATA" })).toThrow();
    const v = bulkStatusSchema.parse({ ids: ["a"], status: "APPROVATA" });
    expect(v.status).toBe("APPROVATA");
  });
});
