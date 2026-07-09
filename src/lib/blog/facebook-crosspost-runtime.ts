import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { readAssetBase64 } from "@/lib/image/store";
import { metaConfigFromDb, publishFacebook } from "@/lib/meta/graph";
import { scrubCompetitors } from "@/lib/blog/competitors";
import type { FbCrossPostDeps } from "./facebook-crosspost";

function excerptFrom(payload: { puntiChiave?: string[]; corpoHtml?: string }): string | undefined {
  const pk = payload.puntiChiave;
  if (Array.isArray(pk) && pk.length) return scrubCompetitors(pk.slice(0, 2).join(" · "));
  const html = payload.corpoHtml;
  if (html) {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) return scrubCompetitors(text.slice(0, 200));
  }
  return undefined;
}

/** Deps reali per il cross-post Blog→Facebook: legge l'articolo dal DB e posta via Graph API. */
export function buildFbCrossPostDeps(): FbCrossPostDeps {
  return {
    loadArticle: async (contentId) => {
      const c = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { assets: true } });
      if (!c || c.canale !== "BLOG" || !c.shopifyArticleUrl) return null;
      const p = (c.payload ?? {}) as { titoloSeo?: string; puntiChiave?: string[]; corpoHtml?: string };
      let image: Buffer | undefined;
      const asset = c.assets[0];
      if (asset?.path) {
        const b64 = readAssetBase64(asset.path);
        if (b64) image = await sharp(Buffer.from(b64, "base64")).resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      }
      return { title: scrubCompetitors(p.titoloSeo ?? "Nuovo articolo"), excerpt: excerptFrom(p), url: c.shopifyArticleUrl, image };
    },
    publish: async ({ caption, image }) => {
      const cfg = await metaConfigFromDb();
      if (!cfg.token || !cfg.pageId) throw new Error("Credenziali Facebook mancanti (Impostazioni → Chiavi API o .env)");
      const r = await publishFacebook(cfg, { postType: image ? "image" : "text", caption, images: image ? [{ bytes: image }] : [] });
      return { postId: r.postId };
    },
  };
}
