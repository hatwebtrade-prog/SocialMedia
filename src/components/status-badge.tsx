interface BadgeDef { label: string; className: string; }

const GREEN = "bg-green-100 text-green-800";
const AMBER = "bg-amber-100 text-amber-800";
const RED = "bg-red-100 text-red-800";
const BLUE = "bg-blue-100 text-blue-800";
const GRAY = "bg-neutral-100 text-neutral-700";

const MAP: Record<string, BadgeDef> = {
  NUOVA: { label: "Nuova", className: GRAY },
  INTERESSANTE: { label: "Interessante", className: AMBER },
  APPROVATA: { label: "Approvata", className: GREEN },
  SCARTATA: { label: "Scartata", className: RED },
  DA_APPROFONDIRE: { label: "Da approfondire", className: BLUE },
  BOZZA: { label: "Bozza", className: GRAY },
  DA_APPROVARE: { label: "Da approvare", className: AMBER },
  APPROVATO: { label: "Approvato", className: GREEN },
  PROGRAMMATO: { label: "Programmato", className: BLUE },
  PUBBLICATO: { label: "Pubblicato", className: GREEN },
  ERRORE: { label: "Errore", className: RED },
};

export function badgeStyle(status: string): BadgeDef {
  return MAP[status] ?? { label: status, className: GRAY };
}

export function StatusBadge({ status }: { status: string }) {
  const b = badgeStyle(status);
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span>;
}
