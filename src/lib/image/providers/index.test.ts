import { describe, it, expect } from "vitest";
import { IMAGE_PROVIDERS, isImageProvider } from "@/lib/image/providers";

describe("image providers", () => {
  it("lists the AI providers", () => {
    expect(IMAGE_PROVIDERS).toEqual(["GPT", "GEMINI", "HIGGSFIELD"]);
  });
  it("validates provider strings", () => {
    expect(isImageProvider("GEMINI")).toBe(true);
    expect(isImageProvider("MANUAL")).toBe(false);
    expect(isImageProvider("x")).toBe(false);
  });
});
