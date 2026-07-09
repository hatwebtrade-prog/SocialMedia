import { prisma } from "@/lib/prisma";
import type { MetaPublishDeps, MetaImage } from "@/lib/meta/publish";
import { describeMetaContent } from "@/lib/meta/describe";
import { metaConfigFromDb, publishFacebook, publishInstagram } from "@/lib/meta/graph";
import { readAssetBase64 } from "@/lib/image/store";

export function publicBaseUrl() {
  return process.env.META_PUBLIC_BASE_URL || "http://localhost:8001";
}

/** Real deps for direct Meta publishing (Prisma + Graph API). Credenziali dal DB con fallback env. */
export async function buildMetaPublishDeps(): Promise<MetaPublishDeps> {
  const cfg = await metaConfigFromDb();
  return {
    loadContent: async (contentId) => {
      const c = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { assets: true } });
      if (!c || c.canale !== "META") return null;
      const desc = describeMetaContent({
        formato: c.formato,
        piattaforme: c.piattaforme as unknown as string[],
        payload: c.payload,
        assets: c.assets.map((a) => ({ path: a.path, slideIndex: a.slideIndex })),
      });
      const ordered = [...c.assets].sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0));
      const images: MetaImage[] = ordered.map((a) => {
        const b64 = a.path ? readAssetBase64(a.path) : null;
        return { bytes: b64 ? Buffer.from(b64, "base64") : undefined, url: `${publicBaseUrl()}/api/assets/${a.id}` };
      });
      return { postType: desc.postType, caption: desc.caption, platforms: desc.platforms, images };
    },
    publishFacebook: (a) => publishFacebook(cfg, a),
    publishInstagram: (a) => publishInstagram(cfg, a),
    persistSuccess: async (contentId, ids) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: { status: "PUBBLICATO", publicationStatus: "PUBBLICATO", publishedAt: new Date(), publicationError: null, facebookPostId: ids.facebookPostId, instagramPostId: ids.instagramPostId },
      });
    },
    persistError: async (contentId, error, ids) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: { publicationStatus: "ERRORE", publicationError: error, facebookPostId: ids.facebookPostId, instagramPostId: ids.instagramPostId },
      });
    },
  };
}
