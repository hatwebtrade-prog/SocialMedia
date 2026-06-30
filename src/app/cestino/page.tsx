"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card, Button, Pill, EmptyState, useToast } from "@/components/ui";

interface TrashIdea {
  id: string;
  titolo: string;
  category: string;
  deletedAt: string | null;
  _count?: { contenuti: number };
}

export default function CestinoPage() {
  const { show } = useToast();
  const [ideas, setIdeas] = useState<TrashIdea[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ideas/trash");
      const data = await res.json();
      setIdeas(Array.isArray(data) ? data : []);
    } catch { setIdeas([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const restore = async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-restore", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Ripristino non riuscito.", "error"); return; }
      show("Idea ripristinata."); await load();
    } catch { show("Ripristino non riuscito.", "error"); }
  };

  const deleteForever = async (idea: TrashIdea) => {
    const extra = idea._count?.contenuti ? ` Verranno eliminati anche ${idea._count.contenuti} contenuti collegati.` : "";
    if (!window.confirm(`Eliminare definitivamente "${idea.titolo}"?${extra} L'azione non è reversibile.`)) return;
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, { method: "DELETE" });
      if (!res.ok) { show("Eliminazione non riuscita.", "error"); return; }
      show("Idea eliminata definitivamente."); await load();
    } catch { show("Eliminazione non riuscita.", "error"); }
  };

  const emptyTrash = async () => {
    const withContent = ideas.filter((i) => (i._count?.contenuti ?? 0) > 0).length;
    const extra = withContent ? ` ${withContent} hanno contenuti collegati che verranno eliminati.` : "";
    if (!window.confirm(`Svuotare il cestino? ${ideas.length} idee verranno eliminate definitivamente.${extra} L'azione non è reversibile.`)) return;
    try {
      const res = await fetch("/api/ideas/trash", { method: "DELETE" });
      if (!res.ok) { show("Svuotamento non riuscito.", "error"); return; }
      show("Cestino svuotato."); await load();
    } catch { show("Svuotamento non riuscito.", "error"); }
  };

  return (
    <div>
      <PageHeader
        title="Cestino"
        subtitle="Idee eliminate — ripristinabili o eliminabili definitivamente."
        actions={<Button variant="danger" onClick={emptyTrash} disabled={ideas.length === 0}>Svuota cestino</Button>}
      />
      {loading ? (
        <p className="text-ink-soft">Caricamento…</p>
      ) : ideas.length === 0 ? (
        <EmptyState title="Il cestino è vuoto" hint="Le idee che sposti nel cestino compaiono qui." />
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <Card key={idea.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <div className="font-display text-sm font-semibold text-ink truncate">{idea.titolo}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                  <span>{idea.category}</span>
                  {idea.deletedAt && <span>· cestinata il {new Date(idea.deletedAt).toLocaleDateString("it-IT")}</span>}
                  {idea._count?.contenuti ? <Pill tone="amber">{idea._count.contenuti} contenuti collegati</Pill> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="soft" onClick={() => restore(idea.id)}>Ripristina</Button>
                <Button size="sm" variant="danger" onClick={() => deleteForever(idea)}>Elimina definitivamente</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
