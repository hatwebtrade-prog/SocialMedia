import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publishBlogContent } from "@/lib/blog/publish";
import { crossPostBlogToFacebook, type FbCrossPostResult } from "@/lib/blog/facebook-crosspost";
import { buildFbCrossPostDeps } from "@/lib/blog/facebook-crosspost-runtime";
import { getDepsFactory } from "./deps-registry";
import { buildBlogPublishDeps } from "./build-deps";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ blogId: z.number(), blogHandle: z.string().min(1), published: z.boolean().optional(), alsoFacebook: z.boolean().optional() });

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });

  const injected = getDepsFactory()();
  const run = injected.__run ?? publishBlogContent;
  const deps = injected.__run ? ({} as never) : buildBlogPublishDeps();

  const result = await run({ contentId: id, blogId: parsed.data.blogId, blogHandle: parsed.data.blogHandle, published: parsed.data.published ?? false }, deps);

  // Cross-post opzionale su Facebook (solo path reale, dopo pubblicazione Shopify riuscita).
  let facebook: FbCrossPostResult | undefined;
  if (!injected.__run) {
    if (parsed.data.alsoFacebook !== undefined) {
      await prisma.generatedContent.update({ where: { id }, data: { alsoFacebook: parsed.data.alsoFacebook } });
    }
    if (result.status === "DONE") {
      const c = await prisma.generatedContent.findUnique({ where: { id }, select: { alsoFacebook: true } });
      if (c?.alsoFacebook) facebook = await crossPostBlogToFacebook(id, buildFbCrossPostDeps());
    }
  }

  return NextResponse.json({ ...result, facebook }, { status: result.status === "ERROR" ? 502 : 200 });
}
