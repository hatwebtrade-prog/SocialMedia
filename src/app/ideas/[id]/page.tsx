"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IDEA_STATUSES } from "@/lib/brain/enums";

interface Idea {
  id: string;
  titolo: string;
  descrizione: string;
  category: string;
  status: string;
  note: string | null;
  seoScore: number;
  viralityScore: number;
  priority: number;
  piattaformeConsigliate: string[];
  product?: { nome: string } | null;
  generationRun?: { id: string; modello: string; promptUsato: string } | null;
}

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/ideas/${id}`).then((r) => r.json()).then(setIdea);
  }, [id]);

  const patch = async (data: Partial<Idea>) => {
    const res = await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setIdea(await res.json()); setSaved(true); setTimeout(() => setSaved(false), 1500); }
  };

  if (!idea) return <p>Caricamento…</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">{idea.titolo}</h1>
      <p className="mb-2 text-neutral-700">{idea.descrizione}</p>
      <p className="mb-4 text-sm text-neutral-500">
        Categoria: {idea.category} · SEO {idea.seoScore} · Viral {idea.viralityScore} · Prio {idea.priority}
        {idea.piattaformeConsigliate?.length ? ` · Piattaforme: ${idea.piattaformeConsigliate.join(", ")}` : ""}
        {idea.product ? ` · Prodotto: ${idea.product.nome}` : ""}
      </p>
      <label className="mb-4 block text-sm">
        Stato:&nbsp;
        <select value={idea.status} onChange={(e) => patch({ status: e.target.value })} className="rounded border p-1">
          {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="mb-2 block text-sm">Note:</label>
      <textarea className="mb-2 w-full rounded border p-2" rows={4} defaultValue={idea.note ?? ""} onBlur={(e) => patch({ note: e.target.value })} />
      {saved && <p className="text-sm text-green-700">Salvato.</p>}
      {idea.generationRun && (
        <p className="mt-4 text-xs text-neutral-400">Generata dall'AI ({idea.generationRun.modello}) — run {idea.generationRun.id}</p>
      )}
    </div>
  );
}
