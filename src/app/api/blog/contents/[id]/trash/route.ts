import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteArticle } from "@/lib/shopify/publish";
import { trashBlogContent, type TrashDeps } from "@/lib/blog/trash";

type Ctx = { params: Promise<{ id: string }> };

function buildTrashDeps(): TrashDeps {
  return {
    loadArticleRef: async (contentId) =>
      prisma.generatedContent.findUnique({ where: { id: contentId }, select: { shopifyArticleId: true } }),
    deleteShopifyArticle: (articleId) => deleteArticle(articleId),
    persistTrashed: async (contentId) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: {
          deletedAt: new Date(),
          status: "BOZZA",
          publicationStatus: "NON_INVIATO",
          publishedAt: null,
          shopifyArticleId: null,
          shopifyArticleUrl: null,
          publicationError: null,
        },
      });
    },
    persistError: async (contentId, error) => {
      await prisma.generatedContent.update({ where: { id: contentId }, data: { publicationError: error } });
    },
  };
}

export async function PATCH(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const result = await trashBlogContent({ contentId: id }, buildTrashDeps());
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
