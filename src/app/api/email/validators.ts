import { z } from "zod";
import { EMAIL_FORMATS } from "@/lib/email/enums";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

export const emailGenerateSchema = z.object({
  ideaId: z.string().min(1),
  formato: z.enum(EMAIL_FORMATS),
});

export const emailUpdateSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  dataPrevista: z.string().datetime().nullable().optional(),
});
