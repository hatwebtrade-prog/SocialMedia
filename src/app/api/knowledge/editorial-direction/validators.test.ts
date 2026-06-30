import { describe, it, expect } from "vitest";
import { editorialDirectionSchema } from "@/app/api/knowledge/editorial-direction/validators";

describe("editorialDirectionSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(editorialDirectionSchema.safeParse({}).success).toBe(true);
  });
  it("accepts partial input with campagna", () => {
    expect(editorialDirectionSchema.safeParse({ campagna: "Estate 2026" }).success).toBe(true);
  });
  it("rejects wrong type for campagna", () => {
    expect(editorialDirectionSchema.safeParse({ campagna: 123 }).success).toBe(false);
  });
});
