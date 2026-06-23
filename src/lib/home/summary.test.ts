import { describe, it, expect } from "vitest";
import { summarize } from "@/lib/home/summary";

describe("summarize", () => {
  it("shapes idea/content counts and upcoming items", () => {
    const out = summarize({
      ideaCounts: [{ status: "NUOVA", count: 3 }, { status: "APPROVATA", count: 2 }],
      contentCounts: [{ canale: "META", status: "BOZZA", count: 1 }, { canale: "BLOG", status: "PROGRAMMATO", count: 4 }],
      seozoomNuove: 5,
      seozoomApprovate: 1,
      upcoming: [{ id: "c1", canale: "BLOG", dataPrevista: "2026-06-25T09:00:00.000Z", titolo: "Guida al magnesio" }],
    });
    expect(out.idee.perStato.NUOVA).toBe(3);
    expect(out.idee.seozoomNuove).toBe(5);
    expect(out.meta.BOZZA).toBe(1);
    expect(out.blog.PROGRAMMATO).toBe(4);
    expect(out.prossimi[0].titolo).toBe("Guida al magnesio");
    expect(out.prossimi[0].canale).toBe("BLOG");
  });
  it("drops upcoming items without a date", () => {
    const out = summarize({ ideaCounts: [], contentCounts: [], seozoomNuove: 0, seozoomApprovate: 0,
      upcoming: [{ id: "x", canale: "META", dataPrevista: null, titolo: "x" }] });
    expect(out.prossimi).toHaveLength(0);
  });
});
