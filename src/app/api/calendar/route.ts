import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCalendarEntry } from "@/lib/calendar/helpers";
import { calendarAssignSchema } from "./validators";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.scheduledAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  }
  if (channel) where.channel = channel;
  if (status) where.content = { status };

  const items = await prisma.editorialCalendarItem.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: { content: { select: { status: true, payload: true, idea: { select: { titolo: true } } } } },
  });
  return NextResponse.json(items.map(toCalendarEntry));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = calendarAssignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const { contentId, scheduledAt } = parsed.data;

  const content = await prisma.generatedContent.findUnique({ where: { id: contentId } });
  if (!content) return NextResponse.json({ error: "Contenuto non trovato" }, { status: 404 });

  const when = new Date(scheduledAt);
  const item = await prisma.$transaction(async (tx) => {
    const it = await tx.editorialCalendarItem.upsert({
      where: { contentId },
      update: { scheduledAt: when, channel: content.canale },
      create: { contentId, scheduledAt: when, channel: content.canale },
    });
    await tx.generatedContent.update({ where: { id: contentId }, data: { status: "PROGRAMMATO", dataPrevista: when } });
    return it;
  });
  return NextResponse.json(item, { status: 201 });
}
