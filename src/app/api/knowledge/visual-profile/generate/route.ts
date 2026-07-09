import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { loadKnowledgeKbItems } from "@/lib/knowledge/items";
import { buildVisualProfilePrompt, parseVisualProfile } from "@/lib/knowledge/visual-profile";

export async function POST() {
  try {
    const items = await loadKnowledgeKbItems();
    const materiale = items.map((i) => `[${i.tipo}] ${i.titolo}: ${i.contenuto}`).join("\n");
    if (!materiale.trim()) return NextResponse.json({ error: "Nessun materiale in Knowledge Base" }, { status: 400 });

    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      messages: [{ role: "user", content: buildVisualProfilePrompt(materiale) }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("Output AI non conforme");
    const parsed = parseVisualProfile(text.text);
    const data = { palette: parsed.palette, stileFotografico: parsed.stileFotografico || null, mood: parsed.mood || null, elementiRicorrenti: parsed.elementiRicorrenti || null, daEvitare: parsed.daEvitare || null };
    const profile = await prisma.brandVisualProfile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore generazione profilo" }, { status: 502 });
  }
}
