export interface DispatchDeps {
  findDue: () => Promise<{ id: string }[]>;
  publishOne: (contentId: string) => Promise<{ status: "DONE" | "ERROR" }>;
}

/** Pubblica tutti i contenuti META "due" e raccoglie gli esiti per id. */
export async function dispatchDueMeta(deps: DispatchDeps): Promise<{ published: string[]; failed: string[] }> {
  const due = await deps.findDue();
  const published: string[] = [];
  const failed: string[] = [];
  for (const c of due) {
    const r = await deps.publishOne(c.id);
    (r.status === "DONE" ? published : failed).push(c.id);
  }
  return { published, failed };
}
