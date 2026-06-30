import { describe, it, expect, vi } from "vitest";
import { dispatchDueMeta } from "./dispatch";

describe("dispatchDueMeta", () => {
  it("pubblica solo i META due e raccoglie esiti", async () => {
    const due = [{ id: "a" }, { id: "b" }];
    const publishOne = vi.fn(async (id: string) => ({ status: id === "a" ? "DONE" : "ERROR" }) as const);
    const r = await dispatchDueMeta({ findDue: async () => due, publishOne });
    expect(publishOne).toHaveBeenCalledTimes(2);
    expect(r.published).toEqual(["a"]);
    expect(r.failed).toEqual(["b"]);
  });
  it("nessun contenuto due -> liste vuote", async () => {
    const r = await dispatchDueMeta({ findDue: async () => [], publishOne: vi.fn() });
    expect(r).toEqual({ published: [], failed: [] });
  });
});
