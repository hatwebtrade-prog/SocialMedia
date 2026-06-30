"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { KanbanColumn as Column } from "@/lib/brain/kanban";
import { IdeaCard, type KanbanIdea } from "./idea-card";
import { EmptyState, Pill } from "@/components/ui";

function DraggableCard({ idea, selected, onToggleSelect, onTrash }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void; onTrash?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""} {...listeners} {...attributes}>
      <IdeaCard idea={idea} selected={selected} onToggleSelect={onToggleSelect} onTrash={onTrash} />
    </div>
  );
}

export function KanbanColumn({ column, ideas, selected, onToggleSelect, onTrash }: {
  column: Column; ideas: KanbanIdea[]; selected: Set<string>; onToggleSelect: (id: string) => void; onTrash?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="font-display text-sm font-semibold text-ink">{column.label}</span>
        <Pill tone="neutral">{ideas.length}</Pill>
      </div>
      <div ref={setNodeRef} className={`flex min-h-32 flex-1 flex-col gap-3 rounded-2xl p-2 transition ${isOver ? "bg-sage-50 ring-2 ring-sage-200" : "bg-sand-50/50"}`}>
        {ideas.map((idea) => (
          <DraggableCard key={idea.id} idea={idea} selected={selected.has(idea.id)} onToggleSelect={onToggleSelect} onTrash={onTrash} />
        ))}
        {ideas.length === 0 && <EmptyState title="Vuota" hint="Nessuna idea qui." />}
      </div>
    </div>
  );
}
