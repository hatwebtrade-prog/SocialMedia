import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deleteKnowledgeFile } from "@/lib/knowledge/store";
import { KNOWLEDGE_TYPES } from "@/lib/brain/enums";

type Ctx = { params: Promise<{ id: string }> };

export const patchSchema = z.object({
  knowledgeType: z.enum(KNOWLEDGE_TYPES).nullable(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Input non valido" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  try {
    const file = await prisma.knowledgeFile.update({ where: { id }, data: { knowledgeType: parsed.data.knowledgeType } });
    return NextResponse.json(file);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const file = await prisma.knowledgeFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  if (file.path) deleteKnowledgeFile(file.path);
  await prisma.knowledgeFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
