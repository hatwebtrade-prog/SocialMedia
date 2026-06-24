"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { IDEA_STATUSES, DESTINAZIONI } from "@/lib/brain/enums";

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
  destinazioni: string[];
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
      <div className="mb-4">
        <span className="mb-1 block text-sm">Destinazioni editoriali:</span>
        <div className="flex flex-wrap gap-3 text-sm">
          {DESTINAZIONI.map((d) => {
            const checked = idea.destinazioni?.includes(d) ?? false;
            return (
              <label key={d} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? (idea.destinazioni ?? []).filter((x) => x !== d)
                      : [...(idea.destinazioni ?? []), d];
                    patch({ destinazioni: next });
                  }}
                />
                {d}
              </label>
            );
          })}
        </div>
      </div>
      {idea.status === "APPROVATA" && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {idea.destinazioni?.includes("META") && (
            <Link href={`/meta/genera?ideaId=${idea.id}`} className="rounded bg-blue-600 px-3 py-1 text-white">Genera contenuto Meta</Link>
          )}
          {idea.destinazioni?.includes("BLOG") && (
            <Link href={`/blog/genera?ideaId=${idea.id}`} className="rounded bg-blue-600 px-3 py-1 text-white">Genera articolo Blog</Link>
          )}
          {(idea.destinazioni?.includes("TIKTOK") || idea.destinazioni?.includes("EMAIL")) && (
            <span className="rounded bg-neutral-100 px-3 py-1 text-neutral-500">TikTok/Email: generatore in arrivo</span>
          )}
        </div>
      )}
      <label className="mb-2 block text-sm">Note:</label>
      <textarea className="mb-2 w-full rounded border p-2" rows={4} defaultValue={idea.note ?? ""} onBlur={(e) => patch({ note: e.target.value })} />
      {saved && <p className="text-sm text-green-700">Salvato.</p>}
      {idea.generationRun && (
        <p className="mt-4 text-xs text-neutral-400">Generata dall'AI ({idea.generationRun.modello}) — run {idea.generationRun.id}</p>
      )}
    </div>
  );
}
