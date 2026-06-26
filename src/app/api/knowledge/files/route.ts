import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { pickFileKind, extractText } from "@/lib/knowledge/extract";
import { saveKnowledgeFile, extFromMime } from "@/lib/knowledge/store";

const schema = z.object({ nome: z.string().min(1), mimeType: z.string().min(1), contentBase64: z.string().min(1) });

export async function GET() {
  const files = await prisma.knowledgeFile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const { nome, mimeType, contentBase64 } = parsed.data;
  const kind = pickFileKind(mimeType);
  if (!kind) return NextResponse.json({ error: "Tipo file non supportato" }, { status: 400 });

  let bytes: Buffer;
  try {
    bytes = Buffer.from(contentBase64.replace(/^data:[^,]+,/, ""), "base64");
  } catch {
    return NextResponse.json({ error: "Contenuto non valido" }, { status: 400 });
  }
  if (bytes.length > 15 * 1024 * 1024) return NextResponse.json({ error: "File troppo grande (max 15MB)" }, { status: 400 });

  const created = await prisma.knowledgeFile.create({ data: { nome, mimeType, kind, path: "", stato: kind === "IMMAGINE" ? "PRONTO" : "IN_CORSO" } });
  const relPath = saveKnowledgeFile(created.id, extFromMime(mimeType, nome), bytes);
  await prisma.knowledgeFile.update({ where: { id: created.id }, data: { path: relPath } });

  if (kind === "DOCUMENTO") {
    try {
      const testo = await extractText(bytes, mimeType, nome);
      await prisma.knowledgeFile.update({ where: { id: created.id }, data: { testo, stato: "PRONTO" } });
    } catch (err) {
      await prisma.knowledgeFile.update({ where: { id: created.id }, data: { stato: "ERRORE", errore: err instanceof Error ? err.message : "Estrazione fallita" } });
    }
  }
  const result = await prisma.knowledgeFile.findUnique({ where: { id: created.id } });
  return NextResponse.json(result, { status: 201 });
}
