import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const run = await prisma.generationRun.findUnique({
    where: { id },
    include: { ideas: { select: { id: true, titolo: true } } },
  });
  if (!run) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(run);
}
