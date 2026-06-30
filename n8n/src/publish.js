// AGOCAP Meta Auto Publisher — "Publish to Meta"
// Code node, mode: Run Once for All Items.
// Publishes to Facebook Page and/or Instagram Business via the Graph API.
// Never throws: any error is caught and turned into a publish_failed callback.
const d = $input.first().json;
const apiVer = $env.META_API_VERSION || 'v20.0';
const token = $env.META_PAGE_ACCESS_TOKEN || '';
const base = 'https://graph.facebook.com/' + apiVer;
const helpers = this.helpers;

const post = (url, payload) => helpers.httpRequest({ method: 'POST', url, body: payload, json: true });
const get = (url) => helpers.httpRequest({ method: 'GET', url, json: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const media = d.media_urls && d.media_urls.length ? d.media_urls : (d.media_url ? [d.media_url] : []);
let fbId = null;
let igId = null;
let error = null;

try {
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN non configurato in n8n');

  // ---------- FACEBOOK ----------
  if (d.platforms.includes('facebook') && d.facebook_page_id) {
    const pid = d.facebook_page_id;
    if (d.post_type === 'text') {
      const r = await post(base + '/' + pid + '/feed', { message: d.caption, access_token: token });
      fbId = r.id;
    } else if (d.post_type === 'carousel') {
      const attached = [];
      for (const url of media) {
        const r = await post(base + '/' + pid + '/photos', { url, published: false, access_token: token });
        attached.push({ media_fbid: r.id });
      }
      const r = await post(base + '/' + pid + '/feed', { message: d.caption, attached_media: attached, access_token: token });
      fbId = r.id;
    } else if (d.post_type === 'image' || d.post_type === 'story') {
      const r = await post(base + '/' + pid + '/photos', { url: media[0], caption: d.caption, access_token: token });
      fbId = r.post_id || r.id;
    }
    // FB reel/video: handled lato app quando esisterà un asset video.
  }

  // ---------- INSTAGRAM ----------
  if (d.platforms.includes('instagram') && d.instagram_account_id) {
    const iid = d.instagram_account_id;

    const publishContainer = async (creationId) => {
      // IG container deve essere FINISHED prima del publish (immagini ~istantanee, video/reel no)
      for (let i = 0; i < 12; i++) {
        try {
          const s = await get(base + '/' + creationId + '?fields=status_code&access_token=' + token);
          if (s.status_code === 'FINISHED') break;
          if (s.status_code === 'ERROR') throw new Error('IG container in ERROR');
        } catch (e) { /* retry */ }
        await sleep(3000);
      }
      const r = await post(base + '/' + iid + '/media_publish', { creation_id: creationId, access_token: token });
      return r.id;
    };

    if (d.post_type === 'carousel') {
      const children = [];
      for (const url of media) {
        const c = await post(base + '/' + iid + '/media', { image_url: url, is_carousel_item: true, access_token: token });
        children.push(c.id);
      }
      const cont = await post(base + '/' + iid + '/media', { media_type: 'CAROUSEL', children: children.join(','), caption: d.caption, access_token: token });
      igId = await publishContainer(cont.id);
    } else if (d.post_type === 'story') {
      const cont = await post(base + '/' + iid + '/media', { image_url: media[0], media_type: 'STORIES', access_token: token });
      igId = await publishContainer(cont.id);
    } else if (d.post_type === 'reel') {
      // RICHIEDE un video_url pubblico — non testabile finché il generatore non produce video.
      const cont = await post(base + '/' + iid + '/media', { media_type: 'REELS', video_url: media[0], caption: d.caption, access_token: token });
      igId = await publishContainer(cont.id);
    } else { // image
      const cont = await post(base + '/' + iid + '/media', { image_url: media[0], caption: d.caption, access_token: token });
      igId = await publishContainer(cont.id);
    }
  }
} catch (e) {
  error = (e && e.message) ? e.message : String(e);
}

// Aggiorna lo stato nel data store
const sd = this.getWorkflowStaticData('global');
sd.seen = sd.seen || {};
sd.seen[d.content_id] = { status: error ? 'publish_failed' : 'published', at: new Date().toISOString() };

const now = new Date().toISOString();
const callbackBody = error
  ? { content_id: d.content_id, status: 'publish_failed', error_message: error, failed_at: now, facebook_post_id: fbId, instagram_post_id: igId }
  : { content_id: d.content_id, status: 'published', published_at: now, facebook_post_id: fbId, instagram_post_id: igId };

return [{ json: { callback_url: d.callback_url, callbackBody } }];
