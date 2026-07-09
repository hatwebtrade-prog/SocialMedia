import { describe, it, expect } from "vitest";
import { isKnownChannel } from "@/components/channel-icon";

describe("isKnownChannel", () => {
  it("recognises channels/platforms", () => {
    ["INSTAGRAM", "FACEBOOK", "TIKTOK", "BLOG", "EMAIL", "META"].forEach((c) => expect(isKnownChannel(c)).toBe(true));
  });
  it("false for unknown", () => {
    expect(isKnownChannel("ZZZ")).toBe(false);
  });
});
