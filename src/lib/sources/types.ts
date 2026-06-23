import type { IdeaCategoryValue, PlatformValue } from "@/lib/brain/enums";

export interface IdeaDraft {
  titolo: string;
  descrizione: string;
  category: IdeaCategoryValue;
  piattaformeConsigliate: PlatformValue[];
  seoScore: number;
  viralityScore: number;
  priority: number;
  prodottoCollegato: string | null;
}

export interface SignalSourceAdapter {
  key: string;
  fetchSignals(input: unknown): Promise<IdeaDraft[]>;
}
