import type { MetaPostType } from "./describe";
import type { MetaImage } from "./publish";

export interface GraphConfig {
  apiVersion: string;
  pageId: string;
  igAccountId: string;
  token: string;
}

export function metaConfigFromEnv(): GraphConfig {
  return {
    apiVersion: process.env.META_API_VERSION || "v20.0",
    pageId: process.env.META_FACEBOOK_PAGE_ID || "",
    igAccountId: process.env.META_INSTAGRAM_ACCOUNT_ID || "",
    token: process.env.META_PAGE_ACCESS_TOKEN || "",
  };
}

/** Config Meta con credenziali dal DB (AppSetting) e fallback su .env. */
export async function metaConfigFromDb(): Promise<GraphConfig> {
  const { getSettingsMap } = await import("@/lib/settings/store");
  const m = await getSettingsMap(["META_PAGE_ACCESS_TOKEN", "META_FACEBOOK_PAGE_ID", "META_INSTAGRAM_ACCOUNT_ID", "META_API_VERSION"]);
  return {
    apiVersion: m.META_API_VERSION || process.env.META_API_VERSION || "v20.0",
    pageId: m.META_FACEBOOK_PAGE_ID || process.env.META_FACEBOOK_PAGE_ID || "",
    igAccountId: m.META_INSTAGRAM_ACCOUNT_ID || process.env.META_INSTAGRAM_ACCOUNT_ID || "",
    token: m.META_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || "",
  };
}

const base = (cfg: GraphConfig) => `https://graph.facebook.com/${cfg.apiVersion}`;

async function gfetch(f: typeof fetch, url: string, init: RequestInit) {
  const res = await f(url, init);
  const text = await res.text();
  let json: { error?: { message?: string }; [k: string]: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `Graph ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

async function fbUploadPhoto(cfg: GraphConfig, f: typeof fetch, bytes: Buffer, opts: { caption?: string; published: boolean }) {
  const form = new FormData();
  form.append("source", new Blob([bytes as unknown as BlobPart], { type: "image/png" }), "image.png");
  if (opts.caption) form.append("caption", opts.caption);
  form.append("published", String(opts.published));
  form.append("access_token", cfg.token);
  return gfetch(f, `${base(cfg)}/${cfg.pageId}/photos`, { method: "POST", body: form });
}

export async function publishFacebook(
  cfg: GraphConfig,
  a: { postType: MetaPostType; caption: string; images: MetaImage[] },
  fetchImpl: typeof fetch = fetch,
): Promise<{ postId: string }> {
  if (a.postType === "text") {
    const r = await gfetch(fetchImpl, `${base(cfg)}/${cfg.pageId}/feed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: a.caption, access_token: cfg.token }),
    });
    return { postId: String(r.id) };
  }
  if (a.postType === "carousel") {
    const fbids: { media_fbid: string }[] = [];
    for (const img of a.images) {
      if (!img.bytes) throw new Error("byte immagine mancanti per il carosello FB");
      const ph = await fbUploadPhoto(cfg, fetchImpl, img.bytes, { published: false });
      fbids.push({ media_fbid: String(ph.id) });
    }
    const r = await gfetch(fetchImpl, `${base(cfg)}/${cfg.pageId}/feed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: a.caption, attached_media: fbids, access_token: cfg.token }),
    });
    return { postId: String(r.id) };
  }
  // image | story -> foto singola
  const img = a.images[0];
  if (!img?.bytes) throw new Error("byte immagine mancanti per il post FB");
  const ph = await fbUploadPhoto(cfg, fetchImpl, img.bytes, { caption: a.caption, published: true });
  return { postId: String(ph.post_id || ph.id) };
}

export async function publishInstagram(
  cfg: GraphConfig,
  a: { postType: MetaPostType; caption: string; images: MetaImage[] },
  fetchImpl: typeof fetch = fetch,
): Promise<{ postId: string }> {
  const url = (path: string, params: Record<string, string>) =>
    `${base(cfg)}/${path}?` + new URLSearchParams({ ...params, access_token: cfg.token }).toString();
  const POST = (u: string) => gfetch(fetchImpl, u, { method: "POST" });

  const createImageContainer = async (imageUrl: string | undefined, extra: Record<string, string>) => {
    if (!imageUrl) throw new Error("IG richiede un image_url pubblico (raggiungibile da internet)");
    return POST(url(`${cfg.igAccountId}/media`, { image_url: imageUrl, ...extra }));
  };
  const waitFinished = async (creationId: string) => {
    for (let i = 0; i < 12; i++) {
      const s = await gfetch(fetchImpl, url(creationId, { fields: "status_code" }), { method: "GET" });
      if (s.status_code === "FINISHED") return;
      if (s.status_code === "ERROR") throw new Error("IG container in stato ERROR");
      await new Promise((r) => setTimeout(r, 3000));
    }
  };
  const publish = async (creationId: string) => {
    await waitFinished(creationId);
    const r = await POST(url(`${cfg.igAccountId}/media_publish`, { creation_id: creationId }));
    return { postId: String(r.id) };
  };

  if (a.postType === "carousel") {
    const children: string[] = [];
    for (const img of a.images) {
      const c = await createImageContainer(img.url, { is_carousel_item: "true" });
      children.push(String(c.id));
    }
    const cont = await POST(url(`${cfg.igAccountId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: a.caption }));
    return publish(String(cont.id));
  }
  if (a.postType === "story") {
    const cont = await createImageContainer(a.images[0]?.url, { media_type: "STORIES" });
    return publish(String(cont.id));
  }
  // image
  const cont = await createImageContainer(a.images[0]?.url, { caption: a.caption });
  return publish(String(cont.id));
}
