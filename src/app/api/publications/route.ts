import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = {};
  const ps = searchParams.get("publicationStatus");
  if (ps) where.publicationStatus = ps;
  const items = await prisma.generatedContent.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { dataPrevista: "asc" }, { createdAt: "desc" }],
    include: { idea: { select: { titolo: true } } },
  });
  return NextResponse.json(items.map((c) => ({
    id: c.id, canale: String(c.canale), status: c.status, publicationStatus: c.publicationStatus,
    publicationError: c.publicationError, dataPrevista: c.dataPrevista, shopifyArticleUrl: c.shopifyArticleUrl,
    titolo: (c.payload as { titoloSeo?: string } | null)?.titoloSeo ?? c.idea?.titolo ?? "Contenuto",
  })));
}
