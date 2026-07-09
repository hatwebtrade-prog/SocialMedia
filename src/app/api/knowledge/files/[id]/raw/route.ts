import { prisma } from "@/lib/prisma";
import { readKnowledgeFile } from "@/lib/knowledge/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const file = await prisma.knowledgeFile.findUnique({ where: { id } });
  if (!file?.path) return new Response("Not found", { status: 404 });
  try {
    const buf = readKnowledgeFile(file.path);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
