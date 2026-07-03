import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
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
  const total = bytes.length;
  // HTTP Range support — required for video seeking and for Safari/iOS to start playback at all.
  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? parseInt(m[2], 10) : total - 1;
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end && end < total) {
      const chunk = bytes.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "content-type": contentType,
          "content-range": `bytes ${start}-${end}/${total}`,
          "accept-ranges": "bytes",
          "content-length": String(chunk.length),
          "cache-control": "private, max-age=60",
        },
      });
    }
  }
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": contentType,
      "accept-ranges": "bytes",
      "content-length": String(total),
      "cache-control": "private, max-age=60",
    },
  });
}
