import { z } from "zod";

export const calendarAssignSchema = z.object({
  contentId: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

export const calendarMoveSchema = z.object({
  scheduledAt: z.string().datetime(),
});
