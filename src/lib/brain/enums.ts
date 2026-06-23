export const KNOWLEDGE_TYPES = [
  "INFO_PRODOTTO", "BRAND_VOICE", "TARGET", "CLAIM", "LINEA_GUIDA", "DOCUMENTO",
] as const;

export type KnowledgeTypeValue = (typeof KNOWLEDGE_TYPES)[number];

export const IDEA_CATEGORIES = [
  "INTEGRATORI", "BEAUTY", "BENESSERE", "STAGIONALITA",
  "EDUCATIONAL", "VENDITA", "FAQ", "TREND",
] as const;

export const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "BLOG"] as const;

export const IDEA_STATUSES = [
  "NUOVA", "INTERESSANTE", "APPROVATA", "SCARTATA", "DA_APPROFONDIRE",
] as const;

export type IdeaCategoryValue = (typeof IDEA_CATEGORIES)[number];
export type PlatformValue = (typeof PLATFORMS)[number];
export type IdeaStatusValue = (typeof IDEA_STATUSES)[number];
