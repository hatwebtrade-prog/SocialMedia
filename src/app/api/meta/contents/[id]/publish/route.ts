import { NextResponse } from "next/server";
import { publishMetaContent } from "@/lib/meta/publish";
import { getDepsFactory } from "./deps-registry";
import { buildMetaPublishDeps } from "./build-deps";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const injected = getDepsFactory()();
  const run = injected.__run ?? publishMetaContent;
  const deps = injected.__run ? ({} as never) : await buildMetaPublishDeps();
  const result = await run({ contentId: id }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
