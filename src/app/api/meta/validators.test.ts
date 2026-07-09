import { describe, it, expect } from "vitest";
import { generateInputSchema, updateContentSchema } from "@/app/api/meta/validators";

describe("generateInputSchema", () => {
  it("accepts a valid POST request", () => {
    const v = generateInputSchema.parse({ ideaId: "i1", formato: "POST", piattaforme: ["INSTAGRAM"] });
    expect(v.formato).toBe("POST");
  });
  it("rejects empty piattaforme", () => {
    expect(() => generateInputSchema.parse({ ideaId: "i1", formato: "POST", piattaforme: [] })).toThrow();
  });
  it("bounds numeroSlide 3-10", () => {
    expect(() => generateInputSchema.parse({ ideaId: "i1", formato: "CAROSELLO", piattaforme: ["INSTAGRAM"], numeroSlide: 99 })).toThrow();
  });
});

describe("updateContentSchema", () => {
  it("accepts partial updates", () => {
    const v = updateContentSchema.parse({ status: "APPROVATO" });
    expect(v.status).toBe("APPROVATO");
  });
  it("rejects an invalid status", () => {
    expect(() => updateContentSchema.parse({ status: "ZZZ" })).toThrow();
  });
});
