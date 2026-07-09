import { prisma } from "@/lib/prisma";
import { publishMetaContent } from "@/lib/meta/publish";
import { publishBlogContent } from "@/lib/blog/publish";
import { resolveBlogTarget } from "@/lib/blog/resolve-blog-target";
import { crossPostBlogToFacebook } from "@/lib/blog/facebook-crosspost";
import { buildFbCrossPostDeps } from "@/lib/blog/facebook-crosspost-runtime";
import { buildMetaPublishDeps } from "@/app/api/meta/contents/[id]/publish/build-deps";
import { buildBlogPublishDeps } from "@/app/api/blog/contents/[id]/publish/build-deps";
import type { RunDueDeps } from "./run-due";

/** Deps reali per lo scheduler: legge i "due" dal DB e pubblica su Meta/Blog. */
export function buildRunDueDeps(): RunDueDeps {
  return {
    findDue: () =>
      prisma.generatedContent.findMany({
        where: {
          canale: { in: ["META", "BLOG"] },
          status: "PROGRAMMATO",
          dataPrevista: { lte: new Date() },
          publicationStatus: { in: ["NON_INVIATO", "ERRORE"] },
          deletedAt: null,
        },
        orderBy: { dataPrevista: "asc" },
        select: { id: true, canale: true },
      }),
    // deps costruite on-demand: se manca la config di un canale, fallisce solo quel canale
    publishMeta: async (id) => publishMetaContent({ contentId: id }, await buildMetaPublishDeps()),
    publishBlog: async (id) => {
      const target = await resolveBlogTarget();
      const r = await publishBlogContent(
        { contentId: id, blogId: target.blogId, blogHandle: target.blogHandle, published: true },
        buildBlogPublishDeps(),
      );
      // Cross-post opzionale su Facebook (flag persistito dalla spunta nel calendario).
      if (r.status === "DONE") {
        const c = await prisma.generatedContent.findUnique({ where: { id }, select: { alsoFacebook: true } });
        if (c?.alsoFacebook) {
          const fb = await crossPostBlogToFacebook(id, buildFbCrossPostDeps());
          if (fb.status === "ERROR") console.error(`[scheduler] cross-post FB fallito per ${id}: ${fb.error}`);
        }
      }
      return r;
    },
    log: (m) => console.log(`[scheduler] ${m}`),
  };
}
