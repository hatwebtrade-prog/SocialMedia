import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  nome: z.string().min(1),
  categoria: z.string().optional(),
  descrizione: z.string().optional(),
  benefici: z.string().optional(),
  ingredienti: z.string().optional(),
  target: z.string().optional(),
  url: z.string().optional(),
});

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const product = await prisma.product.create({ data: parsed.data });
  return NextResponse.json(product, { status: 201 });
}
