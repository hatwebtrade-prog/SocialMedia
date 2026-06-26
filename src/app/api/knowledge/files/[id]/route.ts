import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteKnowledgeFile } from "@/lib/knowledge/store";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const file = await prisma.knowledgeFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  if (file.path) deleteKnowledgeFile(file.path);
  await prisma.knowledgeFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
