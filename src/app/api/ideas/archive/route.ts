import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ideas = await prisma.idea.findMany({
    where: { archivedAt: { not: null }, deletedAt: null },
    orderBy: { archivedAt: "desc" },
    include: {
      product: { select: { nome: true } },
      source: { select: { key: true } },
      _count: { select: { contenuti: true } },
    },
  });
  return NextResponse.json(ideas);
}
