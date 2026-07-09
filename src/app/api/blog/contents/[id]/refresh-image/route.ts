import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { readAssetBase64 } from "@/lib/image/store";
import { updateArticleImage } from "@/lib/shopify/publish";
import { resolveBlogTarget } from "@/lib/blog/resolve-blog-target";

type Ctx = { params: Promise<{ id: string }> };

/** Ri-invia SOLO l'immagine in evidenza a un articolo blog già pubblicato su Shopify
 *  (aggiornamento in-place: non cambia URL, non crea doppioni). */
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await prisma.generatedContent.findUnique({ where: { id }, include: { assets: true } });
  if (!c || c.canale !== "BLOG" || c.deletedAt) return NextResponse.json({ error: "Articolo non trovato" }, { status: 404 });
  if (!c.shopifyArticleId) return NextResponse.json({ error: "Articolo non ancora pubblicato su Shopify" }, { status: 400 });

  const asset = c.assets[0];
  const b64 = asset?.path ? readAssetBase64(asset.path) : null;
  if (!b64) return NextResponse.json({ error: "Nessuna immagine da inviare" }, { status: 400 });

  try {
    const slim = await sharp(Buffer.from(b64, "base64")).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const target = await resolveBlogTarget();
    await updateArticleImage(target.blogId, Number(c.shopifyArticleId), slim.toString("base64"));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore aggiornamento immagine" }, { status: 502 });
  }
}
