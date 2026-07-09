import { prisma } from "@/lib/prisma";
import { publishMetaContent } from "@/lib/meta/publish";
import { publishBlogContent } from "@/lib/blog/publish";
import { resolveBlogTarget } from "@/lib/blog/resolve-blog-target";
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
    publishMeta: (id) => publishMetaContent({ contentId: id }, buildMetaPublishDeps()),
    publishBlog: async (id) => {
      const target = await resolveBlogTarget();
      return publishBlogContent(
        { contentId: id, blogId: target.blogId, blogHandle: target.blogHandle, published: true },
        buildBlogPublishDeps(),
      );
    },
    log: (m) => console.log(`[scheduler] ${m}`),
  };
}
