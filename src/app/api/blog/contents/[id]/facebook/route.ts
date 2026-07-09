import { NextResponse } from "next/server";
import { crossPostBlogToFacebook } from "@/lib/blog/facebook-crosspost";
import { buildFbCrossPostDeps } from "@/lib/blog/facebook-crosspost-runtime";

type Ctx = { params: Promise<{ id: string }> };

/** Ripubblica manualmente un articolo del blog come post sulla Pagina Facebook. */
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const r = await crossPostBlogToFacebook(id, buildFbCrossPostDeps());
  return NextResponse.json(r, { status: r.status === "ERROR" ? 502 : 200 });
}
