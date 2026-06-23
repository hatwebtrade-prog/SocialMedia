import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateIdeaSchema } from "../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const idea = await prisma.idea.findUnique({
    where: { id },
    include: { product: true, generationRun: true },
  });
  if (!idea) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  return NextResponse.json(idea);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  try {
    const idea = await prisma.idea.update({
      where: { id },
      data: parsed.data,
      include: { product: true, generationRun: true },
    });
    return NextResponse.json(idea);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Non trovata" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.idea.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Non trovata" }, { status: 404 });
    }
    throw err;
  }
}
