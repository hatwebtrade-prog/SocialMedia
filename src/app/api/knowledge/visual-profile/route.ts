import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  palette: z.array(z.string()).optional(),
  stileFotografico: z.string().nullish(),
  mood: z.string().nullish(),
  elementiRicorrenti: z.string().nullish(),
  daEvitare: z.string().nullish(),
  referenceImagePaths: z.array(z.string()).optional(),
});

export async function GET() {
  const profile = await prisma.brandVisualProfile.findUnique({ where: { id: "default" } });
  return NextResponse.json(profile ?? { id: "default", palette: [], referenceImagePaths: [] });
}

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const d = parsed.data;
  const data = {
    palette: d.palette ?? [], stileFotografico: d.stileFotografico ?? null, mood: d.mood ?? null,
    elementiRicorrenti: d.elementiRicorrenti ?? null, daEvitare: d.daEvitare ?? null, referenceImagePaths: d.referenceImagePaths ?? [],
  };
  const profile = await prisma.brandVisualProfile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  return NextResponse.json(profile);
}
