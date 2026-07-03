import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { logoPlacement, overlayLogo } from "@/lib/image/logo-overlay";

describe("logoPlacement", () => {
  it("places the logo top-right respecting width% and margin%", () => {
    // 1000x1000 image, logo 4:1 (ratio=4), width 16% => 160x40, margin 4% => 40
    const p = logoPlacement(1000, 1000, 4, { widthPct: 0.16, marginPct: 0.04 });
    expect(p.width).toBe(160);
    expect(p.height).toBe(40);
    expect(p.left).toBe(1000 - 160 - 40); // 800
    expect(p.top).toBe(40);
  });
  it("uses defaults (16% width, 4% margin) and never returns negative offsets", () => {
    const p = logoPlacement(100, 100, 10);
    expect(p.width).toBe(16);
    expect(p.height).toBe(2); // 16/10 rounded
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
  });
});

describe("overlayLogo", () => {
  it("returns a composited PNG the same size as the base image", async () => {
    const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
    const logo = await sharp({ create: { width: 40, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    const out = await overlayLogo(image, logo);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(100);
    expect(meta.format).toBe("png");
  });
  it("returns the original image unchanged on a corrupt logo", async () => {
    const image = await sharp({ create: { width: 50, height: 50, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    const out = await overlayLogo(image, Buffer.from("notanimage"));
    expect(out).toBe(image);
  });
});
