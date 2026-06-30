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
  form.append("source", new Blob([bytes], { type: "image/png" }), "image.png");
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
  _cfg: GraphConfig,
  _a: { postType: MetaPostType; caption: string; images: MetaImage[] },
  _fetchImpl: typeof fetch = fetch,
): Promise<{ postId: string }> {
  throw new Error("publishInstagram non ancora implementato (Task 6)");
}
