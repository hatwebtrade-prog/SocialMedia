"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IdeaFilters, type Filters } from "./idea-filters";
import { StatusBadge } from "./status-badge";
import { ChannelIcons } from "@/components/channel-icon";
import { matchesText } from "@/lib/brain/search";
import { DESTINAZIONI } from "@/lib/brain/enums";
import { KanbanBoard } from "@/components/brain/kanban-board";
import type { KanbanIdea } from "@/components/brain/idea-card";
import type { IdeaStatus } from "@/lib/brain/kanban";
import { approvedIds } from "@/lib/brain/kanban";
import { Button, SegmentedControl, Skeleton, EmptyState, useToast } from "@/components/ui";

type View = "kanban" | "table";

export function IdeaWorkspace() {
  const { show } = useToast();
  const [ideas, setIdeas] = useState<KanbanIdea[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: "", status: "", category: "", platform: "", source: "", destinazione: "", priorita: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destSel, setDestSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [view, setView] = useState<View>("kanban");
  const [showDiscarded, setShowDiscarded] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("brain.view") : null;
    if (saved === "table" || saved === "kanban") setView(saved);
  }, []);
  const changeView = (v: View) => { setView(v); window.localStorage.setItem("brain.view", v); };

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(filters.q), 300); return () => clearTimeout(t); }, [filters.q]);

  const { status, category, platform, source, destinazione, priorita } = filters;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (category) qs.set("category", category);
      if (platform) qs.set("platform", platform);
      if (source) qs.set("source", source);
      if (destinazione) qs.set("destinazione", destinazione);
      if (priorita) qs.set("priority", priorita);
      const res = await fetch(`/api/ideas?${qs.toString()}`);
      const data = await res.json();
      setIdeas(Array.isArray(data) ? data : []);
      setSelected(new Set());
    } catch { setIdeas([]); } finally { setLoading(false); }
  }, [status, category, platform, source, destinazione, priorita]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDest = (d: string) => setDestSel((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const persist = useCallback(async (id: string, s: IdeaStatus): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: s }) });
      return res.ok;
    } catch { return false; }
  }, []);

  const trashOne = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-trash", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Spostamento nel cestino non riuscito.", "error"); return; }
      show("Spostata nel cestino.");
      await load();
    } catch { show("Spostamento nel cestino non riuscito.", "error"); }
  }, [load, show]);

  const bulkTrash = async () => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/ideas/bulk-trash", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected] }) });
      if (!res.ok) { show("Spostamento nel cestino non riuscito.", "error"); return; }
      show("Spostate nel cestino.");
      await load();
    } catch { show("Spostamento nel cestino non riuscito.", "error"); }
  };

  const archiveOne = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-archive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Archiviazione non riuscita.", "error"); return; }
      show("Idea archiviata.");
      await load();
    } catch { show("Archiviazione non riuscita.", "error"); }
  }, [load, show]);

  const bulkArchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/ideas/bulk-archive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res.ok) { show("Archiviazione non riuscita.", "error"); return; }
      show("Idee archiviate.");
      await load();
    } catch { show("Archiviazione non riuscita.", "error"); }
  };

  const bulkStatus = async (s: string) => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/ideas/bulk-status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], status: s }) });
      if (!res.ok) { show("Aggiornamento non riuscito.", "error"); return; }
      show("Stato aggiornato.");
      await load();
    } catch {
      show("Aggiornamento non riuscito.", "error");
    }
  };
  const bulkDestinazioni = async () => {
    if (selected.size === 0 || destSel.size === 0) return;
    try {
      const res = await fetch("/api/ideas/bulk-destinazioni", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], destinazioni: [...destSel] }) });
      if (!res.ok) { show("Assegnazione non riuscita.", "error"); return; }
      setDestSel(new Set());
      show("Canali assegnati.");
      await load();
    } catch {
      show("Assegnazione non riuscita.", "error");
    }
  };

  const visible = ideas.filter((i) => matchesText({ titolo: i.titolo, keyword: i.keyword }, debouncedQ));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <IdeaFilters filters={filters} onChange={setFilters} />
        <div className="flex items-center gap-2">
          {view === "kanban" && (
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} /> Mostra scartate
            </label>
          )}
          <Button size="sm" variant="ghost" onClick={() => bulkArchive(approvedIds(ideas))} disabled={approvedIds(ideas).length === 0}>📥 Archivia approvate</Button>
          <SegmentedControl<View> options={[{ value: "kanban", label: "Kanban" }, { value: "table", label: "Tabella" }]} value={view} onChange={changeView} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-sand-50 p-2 text-sm">
          <Button size="sm" onClick={() => bulkStatus("APPROVATA")}>Approva ({selected.size})</Button>
          <Button size="sm" variant="danger" onClick={() => bulkStatus("SCARTATA")}>Scarta</Button>
          <Button size="sm" variant="soft" onClick={() => bulkStatus("INTERESSANTE")}>Interessante</Button>
          <Button size="sm" variant="ghost" onClick={bulkTrash}>🗑 Cestina ({selected.size})</Button>
          <Button size="sm" variant="ghost" onClick={() => bulkArchive([...selected])}>📥 Archivia ({selected.size})</Button>
          <span className="ml-2 text-ink-soft">Assegna a canali:</span>
          {DESTINAZIONI.map((d) => (
            <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={destSel.has(d)} onChange={() => toggleDest(d)} />{d}</label>
          ))}
          <Button size="sm" variant="soft" onClick={bulkDestinazioni} disabled={destSel.size === 0}>Assegna</Button>
        </div>
      )}

      {loading ? (
        <div className="flex gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-72" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState title="Nessuna idea" hint="Genera nuove idee dal Brain." action={<Link href="/genera"><Button>Genera idee</Button></Link>} />
      ) : view === "kanban" ? (
        <KanbanBoard ideas={visible} setIdeas={setIdeas} selected={selected} onToggleSelect={toggle} showDiscarded={showDiscarded} persist={persist} onTrash={trashOne} onArchive={archiveOne} />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-sand-200 text-left text-ink-soft">
              <th className="p-2"></th><th className="p-2">Titolo</th><th className="p-2">Categoria</th><th className="p-2">Destinazioni</th><th className="p-2">Keyword</th><th className="p-2">SEO</th><th className="p-2">Prio</th><th className="p-2">Stato</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => (
              <tr key={i.id} className="border-b border-sand-100 hover:bg-sand-50">
                <td className="p-2"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                <td className="p-2"><Link href={`/ideas/${i.id}`} className="text-sage-700 hover:underline">{i.titolo}</Link></td>
                <td className="p-2">{i.category}</td>
                <td className="p-2"><ChannelIcons channels={i.destinazioni ?? []} /></td>
                <td className="p-2">{i.keyword ?? "—"}</td>
                <td className="p-2">{i.seoScore}</td>
                <td className="p-2">{i.priority}</td>
                <td className="p-2"><StatusBadge status={i.status} /></td>
                <td className="p-2 whitespace-nowrap">
                  <button onClick={() => archiveOne(i.id)} aria-label="Archivia" title="Archivia" className="mr-2 text-ink-soft hover:text-sage-700">📥</button>
                  <button onClick={() => trashOne(i.id)} aria-label="Sposta nel cestino" title="Sposta nel cestino" className="text-ink-soft hover:text-red-600">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
