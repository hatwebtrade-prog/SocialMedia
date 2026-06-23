import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blogUpdateSchema } from "../../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const content = await prisma.generatedContent.findUnique({
    where: { id },
    include: { idea: { select: { id: true, titolo: true } }, assets: true },
  });
  if (!content) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(content);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = blogUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (parsed.data.payload !== undefined) data.payload = parsed.data.payload;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.dataPrevista !== undefined) {
    data.dataPrevista = parsed.data.dataPrevista ? new Date(parsed.data.dataPrevista) : null;
  }
  try {
    const content = await prisma.generatedContent.update({ where: { id }, data });
    return NextResponse.json(content);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.generatedContent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
