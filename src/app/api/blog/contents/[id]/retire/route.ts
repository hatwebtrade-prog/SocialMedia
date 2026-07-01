import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteArticle } from "@/lib/shopify/publish";
import { retireBlogContent, type RetireDeps } from "@/lib/blog/retire";

type Ctx = { params: Promise<{ id: string }> };

function buildRetireDeps(): RetireDeps {
  return {
    loadArticleRef: async (contentId) =>
      prisma.generatedContent.findUnique({ where: { id: contentId }, select: { shopifyArticleId: true } }),
    deleteShopifyArticle: (articleId) => deleteArticle(articleId),
    persistRetired: async (contentId) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: {
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

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const result = await retireBlogContent({ contentId: id }, buildRetireDeps());
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
