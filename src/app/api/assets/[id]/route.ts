import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const asset = await prisma.generatedAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  if (!asset.path) return NextResponse.json({ error: "File mancante" }, { status: 404 });
  const abs = path.join(process.cwd(), asset.path);
  if (!existsSync(abs)) return NextResponse.json({ error: "File mancante" }, { status: 404 });
  let bytes: Buffer;
  try {
    bytes = readFileSync(abs);
  } catch {
    return NextResponse.json({ error: "File non leggibile" }, { status: 404 });
  }
  const lower = asset.path.toLowerCase();
  const contentType = lower.endsWith(".mp4")
    ? "video/mp4"
    : lower.endsWith(".webm")
      ? "video/webm"
      : "image/png";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "private, max-age=60" },
  });
}
