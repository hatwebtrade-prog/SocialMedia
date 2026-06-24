import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { publishBlogContent, type BlogPublishDeps } from "@/lib/blog/publish";
import { publishArticle } from "@/lib/shopify/publish";
import { readAssetBase64 } from "@/lib/image/store";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ blogId: z.number(), blogHandle: z.string().min(1), published: z.boolean().optional() });

function storeUrl() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN ?? "";
  return process.env.SHOPIFY_STORE_URL ?? `https://${shop}`;
}

function buildDeps(): BlogPublishDeps {
  return {
    loadContent: async (contentId) => {
      const c = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { assets: true } });
      if (!c || c.canale !== "BLOG") return null;
      const p = (c.payload ?? {}) as { titoloSeo?: string; corpoHtml?: string; jsonLd?: string };
      const asset = c.assets[0];
      const imageBase64 = asset?.path ? readAssetBase64(asset.path) ?? undefined : undefined;
      return { titoloSeo: p.titoloSeo ?? "Articolo", corpoHtml: p.corpoHtml ?? "", jsonLd: p.jsonLd, imageBase64 };
    },
    publish: async ({ blogId, blogHandle, title, bodyHtml, imageBase64, published }) => {
      const a = await publishArticle({ blogId, title, bodyHtml, imageBase64, published });
      return { id: a.id, handle: a.handle, url: `${storeUrl()}/blogs/${blogHandle}/${a.handle}` };
    },
    persistSuccess: async (contentId, data) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: { status: "PUBBLICATO", publicationStatus: "PUBBLICATO", publishedAt: new Date(), shopifyArticleId: data.shopifyArticleId, shopifyArticleUrl: data.shopifyArticleUrl },
      });
    },
    persistError: async (contentId, error) => {
      await prisma.generatedContent.update({ where: { id: contentId }, data: { publicationStatus: "ERRORE", publicationError: error } });
    },
  };
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });

  const injected = getDepsFactory()();
  const run = injected.__run ?? publishBlogContent;
  const deps = injected.__run ? ({} as never) : buildDeps();

  const result = await run({ contentId: id, blogId: parsed.data.blogId, blogHandle: parsed.data.blogHandle, published: parsed.data.published ?? false }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
