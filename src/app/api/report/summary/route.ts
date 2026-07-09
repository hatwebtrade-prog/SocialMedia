import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IDEA_CATEGORIES } from "@/lib/brain/enums";

export async function GET() {
  const byStatus = await prisma.idea.groupBy({ by: ["status"], _count: true });
  const byCategory = await prisma.idea.groupBy({ by: ["category"], _count: true });

  const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const categoryCounts = Object.fromEntries(byCategory.map((c) => [c.category, c._count]));

  const alerts: string[] = [];
  if ((statusCounts["APPROVATA"] ?? 0) < 3) {
    alerts.push("Poche idee approvate: meno di 3 pronte per la produzione contenuti.");
  }
  const uncovered = IDEA_CATEGORIES.filter((c) => !categoryCounts[c]);
  if (uncovered.length > 0) {
    alerts.push(`Categorie scoperte (nessuna idea): ${uncovered.join(", ")}.`);
  }
  const lastRun = await prisma.generationRun.findFirst({ orderBy: { createdAt: "desc" } });
  if (!lastRun) {
    alerts.push("Nessuna generazione AI eseguita finora.");
  }

  return NextResponse.json({ statusCounts, categoryCounts, alerts });
}
