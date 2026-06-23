import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { META_PLATFORMS } from "@/lib/meta/enums";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = { canale: "META" };
  const status = searchParams.get("status");
  const formato = searchParams.get("formato");
  const platform = searchParams.get("platform");
  if (status) where.status = status;
  if (formato) where.formato = formato;
  if (platform && (META_PLATFORMS as readonly string[]).includes(platform)) {
    where.piattaforme = { has: platform };
  }

  const contents = await prisma.generatedContent.findMany({
    where,
    orderBy: [{ dataPrevista: "asc" }, { createdAt: "desc" }],
    include: {
      idea: { select: { titolo: true } },
      assets: { select: { id: true, slideIndex: true } },
    },
  });
  return NextResponse.json(contents);
}
