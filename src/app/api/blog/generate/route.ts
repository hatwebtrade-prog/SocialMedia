import { NextResponse } from "next/server";
import { generateBlogArticle } from "@/lib/blog/generate";
import { buildBlogDeps } from "@/lib/blog/runtime";
import { blogGenerateSchema } from "../validators";
import { getDepsFactory } from "./deps-registry";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const parsed = blogGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateBlogArticle;
  const deps = injected.__run ? ({} as never) : buildBlogDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
