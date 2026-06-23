import { NextResponse } from "next/server";
import { generateImageAsset } from "@/lib/image/generate";
import { buildImageRuntimeDeps } from "@/lib/image/runtime";
import { imageInputSchema } from "../../../validators";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = imageInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const slideIndex = parsed.data.slideIndex ?? null;

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateImageAsset;
  const deps = injected.__run ? ({} as never) : buildImageRuntimeDeps();

  const result = await run({ contentId: id, slideIndex }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
