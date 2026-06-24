import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarMoveSchema } from "../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = calendarMoveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const when = new Date(parsed.data.scheduledAt);
  try {
    const item = await prisma.$transaction(async (tx) => {
      const it = await tx.editorialCalendarItem.update({ where: { id }, data: { scheduledAt: when } });
      await tx.generatedContent.update({ where: { id: it.contentId }, data: { dataPrevista: when } });
      return it;
    });
    return NextResponse.json(item);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const item = await prisma.editorialCalendarItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.editorialCalendarItem.delete({ where: { id } });
    await tx.generatedContent.update({ where: { id: item.contentId }, data: { status: "APPROVATO", dataPrevista: null } });
  });
  return NextResponse.json({ ok: true });
}
