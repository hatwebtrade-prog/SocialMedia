import { describe, it, expect } from "vitest";
import { parseDataUrl } from "@/lib/image/manual";

describe("parseDataUrl", () => {
  it("extracts bytes from a png data URL", () => {
    const b64 = Buffer.from("hello").toString("base64");
    const buf = parseDataUrl(`data:image/png;base64,${b64}`);
    expect(buf?.toString()).toBe("hello");
  });
  it("returns null for non-data/non-image input", () => {
    expect(parseDataUrl("http://x/y.png")).toBeNull();
    expect(parseDataUrl("")).toBeNull();
  });
});
