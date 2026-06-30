import { describe, it, expect } from "vitest";
import { patchSchema } from "./route";

describe("patchSchema", () => {
  it("accepts a valid KnowledgeType", () => {
    expect(patchSchema.safeParse({ knowledgeType: "PIANO_EDITORIALE" }).success).toBe(true);
  });
  it("accepts null (removes the tag)", () => {
    expect(patchSchema.safeParse({ knowledgeType: null }).success).toBe(true);
  });
  it("rejects an unknown type", () => {
    expect(patchSchema.safeParse({ knowledgeType: "BOGUS" }).success).toBe(false);
  });
});
