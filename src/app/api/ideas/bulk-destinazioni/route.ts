import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkDestinazioniSchema } from "../validators";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bulkDestinazioniSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const result = await prisma.idea.updateMany({
    where: { id: { in: parsed.data.ids } },
    data: { destinazioni: parsed.data.destinazioni },
  });
  return NextResponse.json({ updated: result.count });
}
