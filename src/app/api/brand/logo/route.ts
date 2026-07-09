import { NextResponse } from "next/server";
import { z } from "zod";
import { saveLogo, hasLogo } from "@/lib/image/logo-store";

const schema = z.object({ dataUrl: z.string().min(1) });

export async function GET() {
  return NextResponse.json({ exists: hasLogo() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const m = parsed.data.dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return NextResponse.json({ error: "Formato immagine non valido (serve PNG/JPEG data URL)" }, { status: 400 });
  const bytes = Buffer.from(m[2], "base64");
  saveLogo(bytes);
  return NextResponse.json({ ok: true });
}
