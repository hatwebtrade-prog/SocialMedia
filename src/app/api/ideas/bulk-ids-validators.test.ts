import { describe, it, expect } from "vitest";
import { bulkIdsSchema } from "@/app/api/ideas/validators";

describe("bulkIdsSchema", () => {
  it("accepts a non-empty array of ids", () => {
    const r = bulkIdsSchema.safeParse({ ids: ["a", "b"] });
    expect(r.success).toBe(true);
  });
  it("rejects an empty array", () => {
    expect(bulkIdsSchema.safeParse({ ids: [] }).success).toBe(false);
  });
  it("rejects a missing ids field", () => {
    expect(bulkIdsSchema.safeParse({}).success).toBe(false);
  });
  it("rejects non-string ids", () => {
    expect(bulkIdsSchema.safeParse({ ids: [1, 2] }).success).toBe(false);
  });
});
