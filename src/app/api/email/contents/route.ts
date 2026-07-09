import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = { canale: "EMAIL" };
  const status = searchParams.get("status");
  if (status) where.status = status;
  const contents = await prisma.generatedContent.findMany({
    where,
    orderBy: [{ dataPrevista: "asc" }, { createdAt: "desc" }],
    include: { idea: { select: { titolo: true } } },
  });
  return NextResponse.json(contents);
}
