import { describe, it, expect } from "vitest";
import { channelColor, contentHref, toCalendarEntry } from "@/lib/calendar/helpers";

describe("calendar helpers", () => {
  it("channelColor differs per channel and falls back", () => {
    expect(channelColor("META")).toContain("blue");
    expect(channelColor("BLOG")).toContain("green");
    expect(channelColor("ZZZ")).toContain("neutral");
  });
  it("contentHref points to the channel detail", () => {
    expect(contentHref("META", "c1")).toBe("/meta/c1");
    expect(contentHref("BLOG", "c1")).toBe("/blog/c1");
    expect(contentHref("EMAIL", "c1")).toBe("#");
  });
  it("toCalendarEntry uses titoloSeo for blog, idea title otherwise", () => {
    const blog = toCalendarEntry({ id: "i1", contentId: "c1", scheduledAt: "2026-06-25T00:00:00.000Z", channel: "BLOG", content: { status: "PROGRAMMATO", payload: { titoloSeo: "Guida" }, idea: { titolo: "Idea X" } } });
    expect(blog.titolo).toBe("Guida");
    expect(blog.href).toBe("/blog/c1");
    expect(blog.status).toBe("PROGRAMMATO");
    const meta = toCalendarEntry({ id: "i2", contentId: "c2", scheduledAt: "2026-06-25T00:00:00.000Z", channel: "META", content: { status: "PROGRAMMATO", payload: {}, idea: { titolo: "Idea Y" } } });
    expect(meta.titolo).toBe("Idea Y");
  });
});
