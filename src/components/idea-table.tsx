"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IdeaFilters, type Filters } from "./idea-filters";

interface Idea {
  id: string;
  titolo: string;
  category: string;
  piattaformeConsigliate: string[];
  seoScore: number;
  viralityScore: number;
  priority: number;
  status: string;
  keyword?: string | null;
  volumeRicerca?: number | null;
  difficolta?: number | null;
  product?: { nome: string } | null;
}

export function IdeaTable() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: "", category: "", platform: "", source: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.status) qs.set("status", filters.status);
      if (filters.category) qs.set("category", filters.category);
      if (filters.platform) qs.set("platform", filters.platform);
      if (filters.source) qs.set("source", filters.source);
      const res = await fetch(`/api/ideas?${qs.toString()}`);
      setIdeas(await res.json());
      setSelected(new Set());
    } catch {
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    await fetch("/api/ideas/bulk-status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [...selected], status }),
    });
    await load();
  };

  return (
    <div>
      <IdeaFilters filters={filters} onChange={setFilters} />
      <div className="mb-3 flex gap-2 text-sm">
        <button onClick={() => bulkStatus("APPROVATA")} className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Approva ({selected.size})</button>
        <button onClick={() => bulkStatus("SCARTATA")} className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Scarta</button>
        <button onClick={() => bulkStatus("INTERESSANTE")} className="rounded bg-amber-500 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Interessante</button>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2"></th>
              <th className="p-2">Titolo</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Vol.</th>
              <th className="p-2">Diff.</th>
              <th className="p-2">SEO</th>
              <th className="p-2">Prio</th>
              <th className="p-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((i) => (
              <tr key={i.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                <td className="p-2"><Link href={`/ideas/${i.id}`} className="text-blue-600 hover:underline">{i.titolo}</Link></td>
                <td className="p-2">{i.category}</td>
                <td className="p-2">{i.keyword ?? "—"}</td>
                <td className="p-2">{i.volumeRicerca ?? "—"}</td>
                <td className="p-2">{i.difficolta ?? "—"}</td>
                <td className="p-2">{i.seoScore}</td>
                <td className="p-2">{i.priority}</td>
                <td className="p-2">{i.status}</td>
              </tr>
            ))}
            {ideas.length === 0 && <tr><td colSpan={9} className="p-4 text-neutral-500">Nessuna idea.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
