"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IdeaFilters, type Filters } from "./idea-filters";
import { StatusBadge } from "./status-badge";
import { DESTINAZIONI } from "@/lib/brain/enums";
import { ChannelIcons } from "@/components/channel-icon";
import { matchesText } from "@/lib/brain/search";

interface Idea {
  id: string;
  titolo: string;
  category: string;
  seoScore: number;
  priority: number;
  status: string;
  keyword?: string | null;
  volumeRicerca?: number | null;
  difficolta?: number | null;
  destinazioni?: string[];
  product?: { nome: string } | null;
  source?: { key: string } | null;
}

const SOURCE_LABEL: Record<string, string> = { "ai-brainstorming": "AI", manuale: "Manuale", seozoom: "SEOZoom" };

export function IdeaTable() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: "", status: "", category: "", platform: "", source: "", destinazione: "", priorita: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destSel, setDestSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

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
    } catch {
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, [status, category, platform, source, destinazione, priorita]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const toggleDest = (d: string) => setDestSel((prev) => {
    const next = new Set(prev); if (next.has(d)) next.delete(d); else next.add(d); return next;
  });

  const bulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    await fetch("/api/ideas/bulk-status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], status }) });
    await load();
  };
  const bulkDestinazioni = async () => {
    if (selected.size === 0 || destSel.size === 0) return;
    await fetch("/api/ideas/bulk-destinazioni", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], destinazioni: [...destSel] }) });
    setDestSel(new Set());
    await load();
  };

  const visible = ideas.filter((i) => matchesText({ titolo: i.titolo, keyword: i.keyword }, debouncedQ));

  return (
    <div>
      <IdeaFilters filters={filters} onChange={setFilters} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => bulkStatus("APPROVATA")} className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Approva ({selected.size})</button>
        <button onClick={() => bulkStatus("SCARTATA")} className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Scarta</button>
        <button onClick={() => bulkStatus("INTERESSANTE")} className="rounded bg-amber-500 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Interessante</button>
        <span className="ml-3 text-neutral-400">|</span>
        <span className="text-neutral-500">Assegna a canali:</span>
        {DESTINAZIONI.map((d) => (
          <label key={d} className="flex items-center gap-1">
            <input type="checkbox" checked={destSel.has(d)} onChange={() => toggleDest(d)} />{d}
          </label>
        ))}
        <button onClick={bulkDestinazioni} className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0 || destSel.size === 0}>Assegna ({selected.size})</button>
      </div>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />)}</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2"></th>
              <th className="p-2">Titolo</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Fonte</th>
              <th className="p-2">Destinazioni</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Vol.</th>
              <th className="p-2">Diff.</th>
              <th className="p-2">SEO</th>
              <th className="p-2">Prio</th>
              <th className="p-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => (
              <tr key={i.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                <td className="p-2"><Link href={`/ideas/${i.id}`} className="text-blue-600 hover:underline">{i.titolo}</Link></td>
                <td className="p-2">{i.category}</td>
                <td className="p-2">{i.source ? (SOURCE_LABEL[i.source.key] ?? i.source.key) : "—"}</td>
                <td className="p-2"><ChannelIcons channels={i.destinazioni ?? []} /></td>
                <td className="p-2">{i.keyword ?? "—"}</td>
                <td className="p-2">{i.volumeRicerca ?? "—"}</td>
                <td className="p-2">{i.difficolta ?? "—"}</td>
                <td className="p-2">{i.seoScore}</td>
                <td className="p-2">{i.priority}</td>
                <td className="p-2"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={11} className="p-4 text-neutral-500">Nessuna idea.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
