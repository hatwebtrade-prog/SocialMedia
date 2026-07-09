import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { KNOWLEDGE_TYPES } from "@/lib/brain/enums";

const schema = z.object({
  tipo: z.enum(KNOWLEDGE_TYPES),
  titolo: z.string().min(1),
  contenuto: z.string().min(1),
  tags: z.array(z.string()).default([]),
  productId: z.string().optional(),
});

export async function GET() {
  const items = await prisma.knowledgeItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const item = await prisma.knowledgeItem.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
