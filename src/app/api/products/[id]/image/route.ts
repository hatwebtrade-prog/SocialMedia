import { prisma } from "@/lib/prisma";
import { readFileSync } from "node:fs";
import path from "node:path";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { imagePath: true } });
  if (!product?.imagePath) return new Response("Not found", { status: 404 });
  try {
    const abs = path.join(process.cwd(), product.imagePath);
    const uploadsRoot = path.join(process.cwd(), "uploads");
    if (!abs.startsWith(uploadsRoot)) return new Response("Forbidden", { status: 403 });
    const buf = readFileSync(abs);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
