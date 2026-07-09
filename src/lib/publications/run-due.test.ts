import { describe, it, expect, vi } from "vitest";
import { runDuePublications } from "./run-due";

describe("runDuePublications", () => {
  it("instrada META a publishMeta e BLOG a publishBlog", async () => {
    const publishMeta = vi.fn().mockResolvedValue({ status: "DONE" });
    const publishBlog = vi.fn().mockResolvedValue({ status: "DONE" });
    const r = await runDuePublications({
      findDue: async () => [
        { id: "m1", canale: "META" },
        { id: "b1", canale: "BLOG" },
      ],
      publishMeta,
      publishBlog,
    });
    expect(publishMeta).toHaveBeenCalledWith("m1");
    expect(publishBlog).toHaveBeenCalledWith("b1");
    expect(r.published).toEqual(["m1", "b1"]);
    expect(r.failed).toEqual([]);
  });

  it("un fallimento (status ERROR) non blocca gli altri", async () => {
    const publishMeta = vi
      .fn()
      .mockResolvedValueOnce({ status: "ERROR" })
      .mockResolvedValueOnce({ status: "DONE" });
    const r = await runDuePublications({
      findDue: async () => [
        { id: "m1", canale: "META" },
        { id: "m2", canale: "META" },
      ],
      publishMeta,
      publishBlog: vi.fn(),
    });
    expect(r.published).toEqual(["m2"]);
    expect(r.failed).toEqual(["m1"]);
  });

  it("un'eccezione lanciata viene isolata e conteggiata come fallita", async () => {
    const publishBlog = vi.fn().mockRejectedValue(new Error("Shopify down"));
    const r = await runDuePublications({
      findDue: async () => [
        { id: "b1", canale: "BLOG" },
        { id: "b2", canale: "BLOG" },
      ],
      publishMeta: vi.fn(),
      publishBlog: publishBlog.mockResolvedValueOnce({ status: "DONE" } as never),
    });
    expect(r.published).toContain("b1");
    expect(r.failed).toContain("b2");
  });

  it("salta i canali non gestiti senza pubblicare", async () => {
    const publishMeta = vi.fn();
    const publishBlog = vi.fn();
    const r = await runDuePublications({
      findDue: async () => [{ id: "e1", canale: "EMAIL" }],
      publishMeta,
      publishBlog,
    });
    expect(publishMeta).not.toHaveBeenCalled();
    expect(publishBlog).not.toHaveBeenCalled();
    expect(r.published).toEqual([]);
    expect(r.failed).toEqual([]);
  });
});
