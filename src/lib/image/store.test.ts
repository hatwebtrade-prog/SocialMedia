import { describe, it, expect, afterAll } from "vitest";
import { rmSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { saveAssetFile, UPLOADS_DIR } from "@/lib/image/store";

const testContentId = "test-content-xyz";

afterAll(() => {
  rmSync(path.join(UPLOADS_DIR, testContentId), { recursive: true, force: true });
});

describe("saveAssetFile", () => {
  it("writes bytes and returns a relative path under uploads", () => {
    const rel = saveAssetFile(testContentId, "asset-abc", Buffer.from("hello"));
    expect(rel).toBe(path.join("uploads", testContentId, "asset-abc.png").replace(/\\/g, "/"));
    const abs = path.join(process.cwd(), rel);
    expect(existsSync(abs)).toBe(true);
    expect(readFileSync(abs).toString()).toBe("hello");
  });
});
