import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarize } from "@/lib/home/summary";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const [ideaGroup, contentGroup, seozoomNuove, seozoomApprovate, upcoming] = await Promise.all([
    prisma.idea.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.generatedContent.groupBy({ by: ["canale", "status"], _count: { _all: true } }),
    prisma.idea.count({ where: { status: "NUOVA", source: { key: "seozoom" } } }),
    prisma.idea.count({ where: { status: "APPROVATA", source: { key: "seozoom" } } }),
    prisma.generatedContent.findMany({
      where: { dataPrevista: { gte: startOfToday() } },
      orderBy: { dataPrevista: "asc" },
      take: 10,
      include: { idea: { select: { titolo: true } } },
    }),
  ]);

  const summary = summarize({
    ideaCounts: ideaGroup.map((g) => ({ status: String(g.status), count: g._count?._all ?? 0 })),
    contentCounts: contentGroup.map((g) => ({ canale: String(g.canale), status: String(g.status), count: g._count?._all ?? 0 })),
    seozoomNuove,
    seozoomApprovate,
    upcoming: upcoming.map((c) => ({
      id: c.id,
      canale: String(c.canale),
      dataPrevista: c.dataPrevista,
      titolo: c.idea?.titolo ?? (c.payload as { titoloSeo?: string } | null)?.titoloSeo ?? "Contenuto",
    })),
  });
  return NextResponse.json(summary);
}
