"use client";

import { IDEA_STATUSES, IDEA_CATEGORIES, PLATFORMS } from "@/lib/brain/enums";

export interface Filters {
  status: string;
  category: string;
  platform: string;
}

export function IdeaFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <div className="mb-4 flex gap-3 text-sm">
      <select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })} className="rounded border p-1">
        <option value="">Tutti gli stati</option>
        {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={filters.category} onChange={(e) => onChange({ ...filters, category: e.target.value })} className="rounded border p-1">
        <option value="">Tutte le categorie</option>
        {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={filters.platform} onChange={(e) => onChange({ ...filters, platform: e.target.value })} className="rounded border p-1">
        <option value="">Tutte le piattaforme</option>
        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
}
