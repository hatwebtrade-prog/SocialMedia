import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { manualIdeaSchema } from "./validators";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = {};
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const platform = searchParams.get("platform");
  const productId = searchParams.get("productId");
  const source = searchParams.get("source");
  if (status) where.status = status;
  if (category) where.category = category;
  if (platform) where.piattaformeConsigliate = { has: platform };
  if (productId) where.productId = productId;
  if (source) where.source = { key: source };

  const ideas = await prisma.idea.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { product: { select: { nome: true } }, source: { select: { key: true } } },
  });
  return NextResponse.json(ideas);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = manualIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }
  const source = await prisma.signalSource.findUniqueOrThrow({ where: { key: "manuale" } });
  const idea = await prisma.idea.create({
    data: { ...parsed.data, sourceId: source.id },
  });
  return NextResponse.json(idea, { status: 201 });
}
