"use client";

import Link from "next/link";
import { LuTrash2, LuArchive } from "react-icons/lu";
import { Card, Pill } from "@/components/ui";
import { ChannelIcons } from "@/components/channel-icon";
import { formatStat, formatVolume, productTone, shortProductName, type IdeaStatus } from "@/lib/brain/kanban";

export interface KanbanIdea {
  id: string;
  titolo: string;
  category: string;
  status: IdeaStatus;
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

export function IdeaCard({ idea, selected, onToggleSelect, onTrash, onArchive }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void; onTrash?: (id: string) => void; onArchive?: (id: string) => void }) {
  return (
    <Card interactive className={`p-3 ${selected ? "ring-2 ring-sage-400" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Pill tone="sage">P{idea.priority}</Pill>
        <div className="flex items-center gap-1.5">
          {onArchive && (
            <button
              onClick={() => onArchive(idea.id)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Archivia"
              title="Archivia"
              className="text-ink-soft transition hover:text-sage-700"
            >
              <LuArchive size={15} />
            </button>
          )}
          {onTrash && (
            <button
              onClick={() => onTrash(idea.id)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Sposta nel cestino"
              title="Sposta nel cestino"
              className="text-ink-soft transition hover:text-red-600"
            >
              <LuTrash2 size={15} />
            </button>
          )}
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(idea.id)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Seleziona idea"
          />
        </div>
      </div>
      <Link href={`/ideas/${idea.id}`} className="block font-display text-sm font-semibold leading-snug text-ink hover:text-sage-700 line-clamp-2">
        {idea.titolo}
      </Link>
      {idea.product && (
        <div className="mt-2 flex" title={idea.product.nome}>
          <Pill tone={productTone(idea.product.nome)} className="max-w-full">
            <span className="truncate">📦 {shortProductName(idea.product.nome)}</span>
          </Pill>
        </div>
      )}
      {idea.keyword && <div className="mt-2"><Pill tone="neutral">{idea.keyword}</Pill></div>}
      <div className="mt-2 text-xs text-ink-soft">
        SEO {formatStat(idea.seoScore)} · vol {formatVolume(idea.volumeRicerca)} · KD {formatStat(idea.difficolta)}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <ChannelIcons channels={idea.destinazioni ?? []} />
        <span className="text-[11px] text-ink-soft">{idea.source ? (SOURCE_LABEL[idea.source.key] ?? idea.source.key) : ""}</span>
      </div>
    </Card>
  );
}
