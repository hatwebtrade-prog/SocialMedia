export const CANALI = ["META", "TIKTOK", "BLOG"] as const;
export const CONTENT_FORMATS = ["POST", "CAROSELLO"] as const;
export const CONTENT_STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"] as const;
// Meta targets reuse the Platform enum values relevant to Meta
export const META_PLATFORMS = ["INSTAGRAM", "FACEBOOK"] as const;

export type ContentFormatValue = (typeof CONTENT_FORMATS)[number];
export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];
export type MetaPlatformValue = (typeof META_PLATFORMS)[number];
