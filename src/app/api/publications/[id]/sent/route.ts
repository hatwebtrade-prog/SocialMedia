import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/publications/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  if (!checkWebhookSecret(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.generatedContent.update({ where: { id }, data: { publicationStatus: "INVIATO_A_N8N" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
