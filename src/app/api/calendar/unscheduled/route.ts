import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contents = await prisma.generatedContent.findMany({
    where: { status: "APPROVATO", calendarItem: null },
    orderBy: { createdAt: "desc" },
    include: { idea: { select: { titolo: true } } },
  });
  return NextResponse.json(
    contents.map((c) => ({
      id: c.id,
      canale: String(c.canale),
      titolo: (c.payload as { titoloSeo?: string } | null)?.titoloSeo ?? c.idea?.titolo ?? "Contenuto",
    })),
  );
}
