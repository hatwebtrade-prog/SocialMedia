import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/publications/auth";

export async function GET(request: Request) {
  if (!checkWebhookSecret(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const due = await prisma.generatedContent.findMany({
    where: { status: "PROGRAMMATO", dataPrevista: { lte: new Date() }, publicationStatus: { in: ["NON_INVIATO", "ERRORE"] } },
    orderBy: { dataPrevista: "asc" },
    include: { idea: { select: { titolo: true } }, assets: { select: { id: true, path: true, slideIndex: true } } },
  });
  return NextResponse.json(due);
}
