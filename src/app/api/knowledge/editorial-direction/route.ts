import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { editorialDirectionSchema } from "./validators";

export async function GET() {
  const d = await prisma.editorialDirection.findUnique({ where: { id: "default" } });
  return NextResponse.json(d ?? { id: "default" });
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Input non valido" }, { status: 400 }); }
  const parsed = editorialDirectionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const p = parsed.data;
  const data = {
    campagna: p.campagna ?? null, periodo: p.periodo ?? null, temi: p.temi ?? null,
    tonoVisivo: p.tonoVisivo ?? null, daMostrare: p.daMostrare ?? null, daEvitare: p.daEvitare ?? null,
  };
  const saved = await prisma.editorialDirection.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  return NextResponse.json(saved);
}
