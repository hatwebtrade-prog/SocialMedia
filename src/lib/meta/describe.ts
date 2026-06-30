export type MetaPostType = "image" | "text" | "carousel" | "story" | "reel";

export interface MetaDescriptor {
  postType: MetaPostType;
  caption: string;
  platforms: ("facebook" | "instagram")[];
  assetPaths: string[]; // ordinati per slideIndex (null = 0)
}

const PLATFORM_MAP: Record<string, "facebook" | "instagram"> = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
};

export function describeMetaContent(content: {
  formato: string;
  piattaforme: string[];
  payload: unknown;
  assets: { path: string; slideIndex: number | null }[];
}): MetaDescriptor {
  const p = (content.payload ?? {}) as { caption?: string; testo?: string };
  const assetPaths = [...content.assets]
    .sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0))
    .map((a) => a.path)
    .filter(Boolean);
  const platforms = content.piattaforme
    .map((x) => PLATFORM_MAP[x])
    .filter(Boolean) as ("facebook" | "instagram")[];

  let postType: MetaPostType;
  if (content.formato === "CAROSELLO") postType = "carousel";
  else if (content.formato === "STORY") postType = "story";
  else if (content.formato === "REEL") postType = "reel";
  else postType = assetPaths.length > 0 ? "image" : "text";

  const caption = content.formato === "STORY" ? (p.testo ?? "") : (p.caption ?? "");
  return { postType, caption, platforms, assetPaths };
}
