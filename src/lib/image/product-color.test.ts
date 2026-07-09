import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { dominantColorHex } from "@/lib/image/product-color";

describe("dominantColorHex", () => {
  it("returns the hex of a solid-colour image", async () => {
    const buf = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 20, b: 120 } } }).png().toBuffer();
    const hex = await dominantColorHex(buf);
    expect(hex).toBe("#c81878");
  });
  it("returns null on invalid input", async () => {
    expect(await dominantColorHex(Buffer.from("notanimage"))).toBeNull();
  });
});
