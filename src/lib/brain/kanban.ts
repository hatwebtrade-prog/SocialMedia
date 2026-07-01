export type IdeaStatus = "NUOVA" | "DA_APPROFONDIRE" | "INTERESSANTE" | "APPROVATA" | "SCARTATA";

export interface KanbanColumn { status: IdeaStatus; label: string }

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { status: "NUOVA", label: "Nuove" },
  { status: "DA_APPROFONDIRE", label: "Da approfondire" },
  { status: "INTERESSANTE", label: "Interessanti" },
  { status: "APPROVATA", label: "Approvate" },
];

export const DISCARDED_COLUMN: KanbanColumn = { status: "SCARTATA", label: "Scartate" };

const ALL: IdeaStatus[] = [...KANBAN_COLUMNS.map((c) => c.status), DISCARDED_COLUMN.status];

export function groupIdeasByStatus<T extends { status: string }>(ideas: T[]): Record<IdeaStatus, T[]> {
  const out = Object.fromEntries(ALL.map((s) => [s, [] as T[]])) as Record<IdeaStatus, T[]>;
  for (const idea of ideas) {
    if (idea.status in out) out[idea.status as IdeaStatus].push(idea);
  }
  return out;
}

export function applyMove<T extends { id: string; status: string }>(ideas: T[], id: string, status: IdeaStatus): T[] {
  return ideas.map((i) => (i.id === id ? { ...i, status } : i));
}

export function formatStat(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

export function approvedIds<T extends { id: string; status: string }>(ideas: T[]): string[] {
  return ideas.filter((i) => i.status === "APPROVATA").map((i) => i.id);
}
