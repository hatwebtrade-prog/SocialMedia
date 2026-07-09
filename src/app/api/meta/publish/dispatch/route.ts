import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMetaContent } from "@/lib/meta/publish";
import { dispatchDueMeta } from "@/lib/meta/dispatch";
import { buildMetaPublishDeps } from "../../contents/[id]/publish/build-deps";

/** Pubblica i contenuti META programmati e arrivati a scadenza. Protetto da secret
 *  (header `x-agocap-secret`), pensato per essere innescato da un cron. */
export async function POST(request: Request) {
  const secret = process.env.AGOCAP_N8N_SECRET || process.env.DISPATCH_SECRET || "";
  if (!secret || request.headers.get("x-agocap-secret") !== secret) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const deps = await buildMetaPublishDeps();
  const result = await dispatchDueMeta({
    findDue: () =>
      prisma.generatedContent.findMany({
        where: { canale: "META", status: "PROGRAMMATO", dataPrevista: { lte: new Date() }, publicationStatus: { in: ["NON_INVIATO", "ERRORE"] } },
        select: { id: true },
      }),
    publishOne: (id) => publishMetaContent({ contentId: id }, deps),
  });
  return NextResponse.json(result);
}
