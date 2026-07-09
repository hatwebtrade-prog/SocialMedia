import { NextResponse } from "next/server";
import { z } from "zod";
import { publishBlogContent } from "@/lib/blog/publish";
import { getDepsFactory } from "./deps-registry";
import { buildBlogPublishDeps } from "./build-deps";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ blogId: z.number(), blogHandle: z.string().min(1), published: z.boolean().optional() });

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });

  const injected = getDepsFactory()();
  const run = injected.__run ?? publishBlogContent;
  const deps = injected.__run ? ({} as never) : buildBlogPublishDeps();

  const result = await run({ contentId: id, blogId: parsed.data.blogId, blogHandle: parsed.data.blogHandle, published: parsed.data.published ?? false }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
