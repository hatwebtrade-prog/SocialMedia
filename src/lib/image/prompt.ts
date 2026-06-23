export interface ImagePromptArgs {
  ideaCreativa: string;
  slideText: string | null;
}

export function buildImagePrompt({ ideaCreativa, slideText }: ImagePromptArgs): string {
  const base = slideText ? `${ideaCreativa}. ${slideText}` : ideaCreativa;
  return `${base}. Stile fotografico pulito e professionale per il brand Agocap (integratori e benessere naturale): luce naturale, toni caldi, alta qualità, adatto a un post social. Nessun testo sovrimpresso.`;
}
