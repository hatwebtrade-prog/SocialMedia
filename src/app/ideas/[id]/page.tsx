"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { IDEA_STATUSES, DESTINAZIONI } from "@/lib/brain/enums";
import { PageHeader, Card, Button, Pill, useToast } from "@/components/ui";

interface Idea {
  id: string; titolo: string; descrizione: string; category: string; status: string; note: string | null;
  seoScore: number; viralityScore: number; priority: number; piattaformeConsigliate: string[]; destinazioni: string[];
  product?: { nome: string } | null; generationRun?: { id: string; modello: string; promptUsato: string } | null;
}

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [idea, setIdea] = useState<Idea | null>(null);

  useEffect(() => { fetch(`/api/ideas/${id}`).then((r) => r.json()).then(setIdea); }, [id]);

  const patch = async (data: Partial<Idea>) => {
    const res = await fetch(`/api/ideas/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) { setIdea(await res.json()); show("Salvato"); } else { show("Salvataggio non riuscito", "error"); }
  };

  if (!idea) return <p className="text-ink-soft">Caricamento…</p>;
  return (
    <div>
      <PageHeader title={idea.titolo} subtitle={`Categoria ${idea.category}`} actions={<Link href="/dashboard"><Button variant="ghost">← Idee</Button></Link>} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <p className="text-ink">{idea.descrizione}</p>
          </Card>
          <Card className="p-5">
            <label className="mb-2 block text-sm font-medium text-ink">Note</label>
            <textarea className="w-full rounded-xl border border-sand-200 bg-surface p-3 text-sm" rows={5} defaultValue={idea.note ?? ""} onBlur={(e) => patch({ note: e.target.value })} />
          </Card>
          {idea.status === "APPROVATA" && (
            <Card className="p-5">
              <p className="mb-3 font-display text-lg text-ink">Genera contenuto</p>
              <div className="flex flex-wrap gap-2">
                {idea.destinazioni?.includes("META") && <Link href={`/meta/genera?ideaId=${idea.id}`}><Button>Contenuto Meta</Button></Link>}
                {idea.destinazioni?.includes("BLOG") && <Link href={`/blog/genera?ideaId=${idea.id}`}><Button>Articolo Blog</Button></Link>}
                {(idea.destinazioni?.includes("TIKTOK") || idea.destinazioni?.includes("EMAIL")) && <Pill tone="neutral">TikTok/Email: generatore in arrivo</Pill>}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <label className="mb-1 block text-sm font-medium text-ink">Stato</label>
            <select value={idea.status} onChange={(e) => patch({ status: e.target.value })} className="w-full rounded-xl border border-sand-200 bg-surface p-2 text-sm">
              {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[["SEO", idea.seoScore], ["Viral", idea.viralityScore], ["Prio", idea.priority]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-sand-50 p-2">
                  <div className="font-display text-lg text-ink">{v as number}</div>
                  <div className="text-[11px] text-ink-soft">{k as string}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <span className="mb-2 block text-sm font-medium text-ink">Destinazioni editoriali</span>
            <div className="flex flex-wrap gap-2">
              {DESTINAZIONI.map((d) => {
                const checked = idea.destinazioni?.includes(d) ?? false;
                return (
                  <button
                    key={d}
                    onClick={() => patch({ destinazioni: checked ? (idea.destinazioni ?? []).filter((x) => x !== d) : [...(idea.destinazioni ?? []), d] })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${checked ? "bg-sage-500 text-white" : "bg-sand-100 text-ink-soft hover:bg-sand-200"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {idea.product && <p className="mt-3 text-xs text-ink-soft">Prodotto: {idea.product.nome}</p>}
            {idea.piattaformeConsigliate?.length > 0 && <p className="mt-1 text-xs text-ink-soft">Piattaforme: {idea.piattaformeConsigliate.join(", ")}</p>}
          </Card>
          {idea.generationRun && <p className="px-1 text-xs text-ink-soft">Generata dall'AI ({idea.generationRun.modello})</p>}
        </aside>
      </div>
    </div>
  );
}
