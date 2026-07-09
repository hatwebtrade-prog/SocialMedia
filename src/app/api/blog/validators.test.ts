import { describe, it, expect } from "vitest";
import { blogGenerateSchema } from "@/app/api/blog/validators";

describe("blogGenerateSchema", () => {
  it("accepts an ideaId", () => {
    expect(blogGenerateSchema.parse({ ideaId: "i1" }).ideaId).toBe("i1");
  });
  it("rejects a missing ideaId", () => {
    expect(() => blogGenerateSchema.parse({})).toThrow();
  });
});
