"use client";

import { IDEA_STATUSES, IDEA_CATEGORIES, PLATFORMS, DESTINAZIONI } from "@/lib/brain/enums";

export interface Filters {
  status: string;
  category: string;
  platform: string;
  source: string;
  destinazione: string;
  priorita: string;
}

const SOURCES = [
  { key: "", label: "Tutte le sorgenti" },
  { key: "ai-brainstorming", label: "AI" },
  { key: "manuale", label: "Manuale" },
  { key: "seozoom", label: "SEOZoom" },
];

export function IdeaFilters({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v });
  return (
    <div className="mb-4 flex flex-wrap gap-3 text-sm">
      <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="rounded border p-1">
        <option value="">Tutti gli stati</option>
        {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={filters.source} onChange={(e) => set("source", e.target.value)} className="rounded border p-1">
        {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <select value={filters.destinazione} onChange={(e) => set("destinazione", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le destinazioni</option>
        {DESTINAZIONI.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={filters.category} onChange={(e) => set("category", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le categorie</option>
        {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={filters.platform} onChange={(e) => set("platform", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le piattaforme</option>
        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={filters.priorita} onChange={(e) => set("priorita", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le priorità</option>
        {[5, 4, 3, 2, 1].map((p) => <option key={p} value={String(p)}>Priorità {p}</option>)}
      </select>
    </div>
  );
}
