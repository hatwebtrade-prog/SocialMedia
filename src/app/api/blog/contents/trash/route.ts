import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contents = await prisma.generatedContent.findMany({
    where: { canale: "BLOG", deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: { idea: { select: { titolo: true } }, assets: { select: { id: true } } },
  });
  return NextResponse.json(contents);
}
