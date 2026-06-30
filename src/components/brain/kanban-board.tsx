"use client";

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KANBAN_COLUMNS, DISCARDED_COLUMN, groupIdeasByStatus, applyMove, type IdeaStatus } from "@/lib/brain/kanban";
import { KanbanColumn } from "./kanban-column";
import type { KanbanIdea } from "./idea-card";
import { useToast } from "@/components/ui";

const VALID = new Set<string>([...KANBAN_COLUMNS.map((c) => c.status), DISCARDED_COLUMN.status]);

export function KanbanBoard({ ideas, setIdeas, selected, onToggleSelect, showDiscarded, persist }: {
  ideas: KanbanIdea[];
  setIdeas: (updater: (prev: KanbanIdea[]) => KanbanIdea[]) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  showDiscarded: boolean;
  persist: (id: string, status: IdeaStatus) => Promise<boolean>;
}) {
  const { show } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const grouped = groupIdeasByStatus(ideas);
  const columns = showDiscarded ? [...KANBAN_COLUMNS, DISCARDED_COLUMN] : KANBAN_COLUMNS;

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const target = e.over ? String(e.over.id) : null;
    if (!target || !VALID.has(target)) return;
    const current = ideas.find((i) => i.id === id);
    if (!current || current.status === target) return;
    const previous = current.status;
    setIdeas((prev) => applyMove(prev, id, target as IdeaStatus));
    const ok = await persist(id, target as IdeaStatus);
    if (!ok) {
      setIdeas((prev) => applyMove(prev, id, previous));
      show("Spostamento non riuscito, ripristinato.", "error");
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => (
          <KanbanColumn key={col.status} column={col} ideas={grouped[col.status] ?? []} selected={selected} onToggleSelect={onToggleSelect} />
        ))}
      </div>
    </DndContext>
  );
}
