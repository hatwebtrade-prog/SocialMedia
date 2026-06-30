"use client";

import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { ChannelIcons } from "@/components/channel-icon";
import { formatStat, formatVolume } from "@/lib/brain/kanban";

export interface KanbanIdea {
  id: string;
  titolo: string;
  category: string;
  status: string;
  priority: number;
  seoScore: number;
  keyword?: string | null;
  volumeRicerca?: number | null;
  difficolta?: number | null;
  destinazioni?: string[];
  product?: { nome: string } | null;
  source?: { key: string } | null;
}

const SOURCE_LABEL: Record<string, string> = { "ai-brainstorming": "AI", manuale: "Manuale", seozoom: "SEOZoom" };

export function IdeaCard({ idea, selected, onToggleSelect }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void }) {
  return (
    <Card interactive className={`p-3 ${selected ? "ring-2 ring-sage-400" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Pill tone="sage">P{idea.priority}</Pill>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(idea.id)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Seleziona idea"
        />
      </div>
      <Link href={`/ideas/${idea.id}`} className="block font-display text-sm font-semibold leading-snug text-ink hover:text-sage-700 line-clamp-2">
        {idea.titolo}
      </Link>
      {idea.keyword && <div className="mt-2"><Pill tone="neutral">{idea.keyword}</Pill></div>}
      <div className="mt-2 text-xs text-ink-soft">
        SEO {formatStat(idea.seoScore)} · vol {formatVolume(idea.volumeRicerca)} · KD {formatStat(idea.difficolta)}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <ChannelIcons channels={idea.destinazioni ?? []} />
        <span className="text-[11px] text-ink-soft">{idea.source ? (SOURCE_LABEL[idea.source.key] ?? idea.source.key) : ""}</span>
      </div>
      {idea.product && <div className="mt-1 text-[11px] text-ink-soft">📦 {idea.product.nome}</div>}
    </Card>
  );
}
