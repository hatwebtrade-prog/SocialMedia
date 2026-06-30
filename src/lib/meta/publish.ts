import type { MetaPostType } from "./describe";

export interface MetaImage {
  bytes?: Buffer;
  url?: string;
}

export interface MetaContentData {
  postType: MetaPostType;
  caption: string;
  platforms: ("facebook" | "instagram")[];
  images: MetaImage[];
}

export interface MetaPublishDeps {
  loadContent: (contentId: string) => Promise<MetaContentData | null>;
  publishFacebook: (a: { postType: MetaPostType; caption: string; images: MetaImage[] }) => Promise<{ postId: string }>;
  publishInstagram: (a: { postType: MetaPostType; caption: string; images: MetaImage[] }) => Promise<{ postId: string }>;
  persistSuccess: (contentId: string, ids: { facebookPostId?: string; instagramPostId?: string }) => Promise<void>;
  persistError: (contentId: string, error: string, ids: { facebookPostId?: string; instagramPostId?: string }) => Promise<void>;
}

export interface MetaPublishResult {
  status: "DONE" | "ERROR";
  facebookPostId?: string;
  instagramPostId?: string;
  error?: string;
}

export async function publishMetaContent(input: { contentId: string }, deps: MetaPublishDeps): Promise<MetaPublishResult> {
  const data = await deps.loadContent(input.contentId);
  if (!data) return { status: "ERROR", error: "Contenuto non trovato" };

  if (data.postType === "reel") {
    await deps.persistError(input.contentId, "Formato REEL/video non supportato in pubblicazione diretta", {});
    return { status: "ERROR", error: "Formato REEL/video non supportato" };
  }
  if (data.platforms.length === 0) {
    await deps.persistError(input.contentId, "Nessuna piattaforma selezionata", {});
    return { status: "ERROR", error: "Nessuna piattaforma selezionata" };
  }

  const ids: { facebookPostId?: string; instagramPostId?: string } = {};
  const errors: string[] = [];
  const args = { postType: data.postType, caption: data.caption, images: data.images };

  if (data.platforms.includes("facebook")) {
    try {
      ids.facebookPostId = (await deps.publishFacebook(args)).postId;
    } catch (e) {
      errors.push("facebook: " + (e instanceof Error ? e.message : String(e)));
    }
  }
  if (data.platforms.includes("instagram")) {
    try {
      ids.instagramPostId = (await deps.publishInstagram(args)).postId;
    } catch (e) {
      errors.push("instagram: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  if (errors.length > 0) {
    await deps.persistError(input.contentId, errors.join(" | "), ids);
    return { status: "ERROR", error: errors.join(" | "), ...ids };
  }
  await deps.persistSuccess(input.contentId, ids);
  return { status: "DONE", ...ids };
}
