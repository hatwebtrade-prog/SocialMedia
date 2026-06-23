export interface UpcomingItem { id: string; canale: string; titolo: string; dataPrevista: string; }
export interface HomeSummary {
  idee: { perStato: Record<string, number>; seozoomNuove: number; seozoomApprovate: number };
  meta: Record<string, number>;
  blog: Record<string, number>;
  prossimi: UpcomingItem[];
}

export interface SummarizeInput {
  ideaCounts: { status: string; count: number }[];
  contentCounts: { canale: string; status: string; count: number }[];
  seozoomNuove: number;
  seozoomApprovate: number;
  upcoming: { id: string; canale: string; dataPrevista: Date | string | null; titolo: string }[];
}

export function summarize(input: SummarizeInput): HomeSummary {
  const perStato: Record<string, number> = {};
  for (const r of input.ideaCounts) perStato[r.status] = r.count;

  const channelMap = (canale: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const r of input.contentCounts) if (r.canale === canale) out[r.status] = r.count;
    return out;
  };

  return {
    idee: { perStato, seozoomNuove: input.seozoomNuove, seozoomApprovate: input.seozoomApprovate },
    meta: channelMap("META"),
    blog: channelMap("BLOG"),
    prossimi: input.upcoming
      .filter((u) => u.dataPrevista)
      .map((u) => ({ id: u.id, canale: u.canale, titolo: u.titolo, dataPrevista: new Date(u.dataPrevista as string | Date).toISOString() })),
  };
}
