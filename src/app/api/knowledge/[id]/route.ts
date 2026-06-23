import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  titolo: z.string().min(1).optional(),
  contenuto: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  try {
    const item = await prisma.knowledgeItem.update({ where: { id }, data: parsed.data });
    return NextResponse.json(item);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.knowledgeItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }
    throw err;
  }
}
