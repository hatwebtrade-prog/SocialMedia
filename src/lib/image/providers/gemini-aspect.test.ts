import { describe, expect, it } from "vitest";
import { aspectNote } from "./gemini";

describe("aspectNote", () => {
  it('maps "1024x1536" to vertical 9:16', () => {
    expect(aspectNote("1024x1536")).toBe("Formato verticale 9:16.");
  });

  it('maps "1536x1024" to horizontal 16:9', () => {
    expect(aspectNote("1536x1024")).toBe("Formato orizzontale 16:9.");
  });

  it('maps "1024x1024" to square 1:1', () => {
    expect(aspectNote("1024x1024")).toBe("Formato quadrato 1:1.");
  });

  it("maps undefined to square 1:1", () => {
    expect(aspectNote(undefined)).toBe("Formato quadrato 1:1.");
  });
});
