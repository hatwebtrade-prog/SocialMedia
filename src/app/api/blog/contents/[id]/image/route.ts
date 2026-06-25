import { NextResponse } from "next/server";
import { generateImageAsset } from "@/lib/image/generate";
import { buildBlogImageDeps } from "@/lib/image/runtime";
import { imageInputSchema } from "@/app/api/meta/validators";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = imageInputSchema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateImageAsset;
  const deps = injected.__run ? ({} as never) : buildBlogImageDeps();

  const result = await run({ contentId: id, slideIndex: null, productId: parsed.data.productId, useMockup: parsed.data.useMockup, provider: parsed.data.provider, brief: parsed.data.brief, styleId: parsed.data.styleId }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
