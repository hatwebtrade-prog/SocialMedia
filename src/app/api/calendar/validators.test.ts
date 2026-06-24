import { describe, it, expect } from "vitest";
import { calendarAssignSchema, calendarMoveSchema } from "@/app/api/calendar/validators";

describe("calendar validators", () => {
  it("assign requires contentId + ISO datetime", () => {
    expect(calendarAssignSchema.parse({ contentId: "c1", scheduledAt: "2026-06-25T00:00:00.000Z" }).contentId).toBe("c1");
    expect(() => calendarAssignSchema.parse({ contentId: "c1", scheduledAt: "nope" })).toThrow();
  });
  it("move requires ISO datetime", () => {
    expect(() => calendarMoveSchema.parse({ scheduledAt: "2026-06-25" })).toThrow();
  });
});
