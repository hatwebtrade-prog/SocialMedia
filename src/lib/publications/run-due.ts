export interface DueContent {
  id: string;
  canale: string;
}

export interface RunDueDeps {
  /** Contenuti programmati e scaduti, non ancora pubblicati. */
  findDue: () => Promise<DueContent[]>;
  publishMeta: (contentId: string) => Promise<{ status: "DONE" | "ERROR" }>;
  publishBlog: (contentId: string) => Promise<{ status: "DONE" | "ERROR" }>;
  log?: (msg: string) => void;
}

/**
 * Pubblica tutti i contenuti "due" instradandoli sul canale giusto (Meta o Blog).
 * Sequenziale e a prova di errore: un fallimento su un contenuto non blocca gli altri.
 */
export async function runDuePublications(deps: RunDueDeps): Promise<{ published: string[]; failed: string[] }> {
  const due = await deps.findDue();
  const published: string[] = [];
  const failed: string[] = [];
  for (const c of due) {
    try {
      let r: { status: "DONE" | "ERROR" };
      if (c.canale === "META") r = await deps.publishMeta(c.id);
      else if (c.canale === "BLOG") r = await deps.publishBlog(c.id);
      else {
        deps.log?.(`Canale non gestito dallo scheduler: ${c.canale} (${c.id})`);
        continue;
      }
      (r.status === "DONE" ? published : failed).push(c.id);
    } catch (e) {
      failed.push(c.id);
      deps.log?.(`Errore pubblicazione ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { published, failed };
}
