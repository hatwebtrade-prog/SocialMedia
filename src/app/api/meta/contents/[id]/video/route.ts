import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVideoAsset } from "@/lib/video/generate";
import { buildVideoDeps } from "@/lib/video/runtime";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ slideIndex: z.number().int().min(0).nullable().optional(), prompt: z.string().optional() });

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const injected = getDepsFactory()();
  const run = injected.__run ?? generateVideoAsset;
  const deps = injected.__run ? ({} as never) : buildVideoDeps();
  const result = await run({ contentId: id, slideIndex: parsed.data.slideIndex ?? null, prompt: parsed.data.prompt }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
