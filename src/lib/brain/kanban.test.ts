import { describe, it, expect } from "vitest";
import {
  KANBAN_COLUMNS, DISCARDED_COLUMN, groupIdeasByStatus, applyMove, formatStat, formatVolume,
} from "@/lib/brain/kanban";

describe("kanban columns", () => {
  it("has 4 primary columns in editorial order, excluding SCARTATA", () => {
    expect(KANBAN_COLUMNS.map((c) => c.status)).toEqual([
      "NUOVA", "DA_APPROFONDIRE", "INTERESSANTE", "APPROVATA",
    ]);
    expect(DISCARDED_COLUMN.status).toBe("SCARTATA");
  });
});

describe("groupIdeasByStatus", () => {
  it("buckets ideas by status and returns empty arrays for empty buckets", () => {
    const g = groupIdeasByStatus([
      { id: "a", status: "NUOVA" },
      { id: "b", status: "APPROVATA" },
      { id: "c", status: "NUOVA" },
    ]);
    expect(g.NUOVA.map((i) => i.id)).toEqual(["a", "c"]);
    expect(g.APPROVATA.map((i) => i.id)).toEqual(["b"]);
    expect(g.INTERESSANTE).toEqual([]);
    expect(g.SCARTATA).toEqual([]);
  });
});

describe("applyMove", () => {
  it("changes the status of the matching idea, leaving others untouched", () => {
    const ideas = [{ id: "a", status: "NUOVA" }, { id: "b", status: "NUOVA" }];
    const next = applyMove(ideas, "a", "APPROVATA");
    expect(next.find((i) => i.id === "a")!.status).toBe("APPROVATA");
    expect(next.find((i) => i.id === "b")!.status).toBe("NUOVA");
    expect(ideas[0].status).toBe("NUOVA"); // original not mutated
  });
});

describe("formatStat / formatVolume", () => {
  it("formats null/undefined as em dash", () => {
    expect(formatStat(null)).toBe("—");
    expect(formatStat(undefined)).toBe("—");
    expect(formatStat(72)).toBe("72");
  });
  it("formats volume compactly above 1000", () => {
    expect(formatVolume(950)).toBe("950");
    expect(formatVolume(1900)).toBe("1.9k");
    expect(formatVolume(12000)).toBe("12k");
    expect(formatVolume(null)).toBe("—");
  });
});
