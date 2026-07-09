"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card, Button, Pill, EmptyState, useToast } from "@/components/ui";

interface ArchivedIdea {
  id: string;
  titolo: string;
  category: string;
  status: string;
  archivedAt: string | null;
  _count?: { contenuti: number };
}

export default function ArchivioPage() {
  const { show } = useToast();
  const [ideas, setIdeas] = useState<ArchivedIdea[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ideas/archive");
      if (!res.ok) { show("Caricamento dell'archivio non riuscito.", "error"); setIdeas([]); return; }
      const data = await res.json();
      setIdeas(Array.isArray(data) ? data : []);
    } catch { show("Caricamento dell'archivio non riuscito.", "error"); setIdeas([]); } finally { setLoading(false); }
  }, [show]);
  useEffect(() => { load(); }, [load]);

  const restore = async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-unarchive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Ripristino non riuscito.", "error"); return; }
      show("Idea ripristinata sul board."); await load();
    } catch { show("Ripristino non riuscito.", "error"); }
  };

  const toTrash = async (idea: ArchivedIdea) => {
    const extra = idea._count?.contenuti ? ` Ha ${idea._count.contenuti} contenuti collegati.` : "";
    if (!window.confirm(`Spostare "${idea.titolo}" nel cestino?${extra}`)) return;
    try {
      const res = await fetch("/api/ideas/bulk-trash", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [idea.id] }) });
      if (!res.ok) { show("Spostamento nel cestino non riuscito.", "error"); return; }
      show("Spostata nel cestino."); await load();
    } catch { show("Spostamento nel cestino non riuscito.", "error"); }
  };

  return (
    <div>
      <PageHeader
        title="Archivio"
        subtitle="Idee concluse messe da parte — ripristinabili sul board o spostabili nel cestino."
      />
      {loading ? (
        <p className="text-ink-soft">Caricamento…</p>
      ) : ideas.length === 0 ? (
        <EmptyState title="Archivio vuoto" hint="Le idee che archivi dal board compaiono qui." />
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <Card key={idea.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <div className="font-display text-sm font-semibold text-ink truncate">{idea.titolo}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                  <span>{idea.category}</span>
                  <Pill tone="neutral">{idea.status}</Pill>
                  {idea.archivedAt && <span>· archiviata il {new Date(idea.archivedAt).toLocaleDateString("it-IT")}</span>}
                  {idea._count?.contenuti ? <Pill tone="amber">{idea._count.contenuti} contenuti collegati</Pill> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="soft" onClick={() => restore(idea.id)}>Ripristina</Button>
                <Button size="sm" variant="ghost" onClick={() => toTrash(idea)}>Sposta nel cestino</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
