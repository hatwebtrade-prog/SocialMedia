import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkIdsSchema } from "../validators";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bulkIdsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const result = await prisma.idea.updateMany({
    where: { id: { in: parsed.data.ids }, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return NextResponse.json({ archived: result.count });
}
