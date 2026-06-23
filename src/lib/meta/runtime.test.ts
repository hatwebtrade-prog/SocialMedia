import { describe, it, expect } from "vitest";
import { stripFences } from "@/lib/meta/runtime";

describe("stripFences", () => {
  it("removes ```json fences and trims", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("returns plain JSON unchanged", () => {
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });
});
