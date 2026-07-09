import { describe, it, expect, vi, beforeEach } from "vitest";

const txMock = {
  editorialCalendarItem: { upsert: vi.fn().mockResolvedValue({ id: "cal1", contentId: "c1" }) },
  generatedContent: { update: vi.fn().mockResolvedValue({}) },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: { findUnique: vi.fn().mockResolvedValue({ id: "c1", canale: "BLOG" }) },
    editorialCalendarItem: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(txMock)),
  },
}));

import { POST } from "@/app/api/calendar/route";
import { prisma } from "@/lib/prisma";

function req(body: unknown) {
  return new Request("http://test/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/calendar", () => {
  beforeEach(() => vi.clearAllMocks());
  it("schedules: upserts item + sets content PROGRAMMATO + dataPrevista", async () => {
    const res = await POST(req({ contentId: "c1", scheduledAt: "2026-06-25T00:00:00.000Z" }));
    expect(res.status).toBe(201);
    expect(txMock.editorialCalendarItem.upsert).toHaveBeenCalled();
    expect(txMock.generatedContent.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "PROGRAMMATO" }) }));
  });
  it("404 when content missing", async () => {
    (prisma.generatedContent.findUnique as any).mockResolvedValueOnce(null);
    const res = await POST(req({ contentId: "x", scheduledAt: "2026-06-25T00:00:00.000Z" }));
    expect(res.status).toBe(404);
  });
  it("400 on invalid input", async () => {
    const res = await POST(req({ contentId: "c1", scheduledAt: "nope" }));
    expect(res.status).toBe(400);
  });
});
