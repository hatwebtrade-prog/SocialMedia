import { z } from "zod";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

export const blogGenerateSchema = z.object({
  ideaId: z.string().min(1),
});

export const blogUpdateSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  dataPrevista: z.string().datetime().nullable().optional(),
});
