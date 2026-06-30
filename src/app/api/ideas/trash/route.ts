import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ideas = await prisma.idea.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: {
      product: { select: { nome: true } },
      source: { select: { key: true } },
      _count: { select: { contenuti: true } },
    },
  });
  return NextResponse.json(ideas);
}

export async function DELETE() {
  const result = await prisma.idea.deleteMany({ where: { deletedAt: { not: null } } });
  return NextResponse.json({ deleted: result.count });
}
