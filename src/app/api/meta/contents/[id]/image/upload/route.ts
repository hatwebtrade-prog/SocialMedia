import { NextResponse } from "next/server";
import { z } from "zod";
import { parseDataUrl, saveManualImage } from "@/lib/image/manual";

const schema = z.object({ slideIndex: z.number().int().min(0).nullable().optional(), dataUrl: z.string() });
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const bytes = parseDataUrl(parsed.data.dataUrl);
  if (!bytes) return NextResponse.json({ error: "Immagine non valida (atteso data URL image/*)" }, { status: 400 });
  try {
    const { assetId } = await saveManualImage(id, parsed.data.slideIndex ?? null, bytes);
    return NextResponse.json({ status: "DONE", assetId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore salvataggio" }, { status: 500 });
  }
}
