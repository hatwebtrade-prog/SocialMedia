// AGOCAP Meta Auto Publisher — "Validate, Auth & Dedup"
// Code node, mode: Run Once for All Items.
// Reads the webhook event, checks the shared secret, validates required
// fields, blocks duplicate content_id via workflow static data, and routes.
const ev = $input.first().json;
const headers = ev.headers || {};
const body = ev.body || {};

const secret = $env.AGOCAP_N8N_SECRET || '';
const got = headers['x-agocap-secret'] || headers['X-Agocap-Secret'] || '';

function reject(httpStatus, reason, route) {
  return [{ json: {
    route,
    httpStatus,
    accepted: false,
    content_id: body.content_id || null,
    callback_url: body.status_callback_url || '',
    error_message: reason,
  } }];
}

// 1) Auth — never call back on auth failure (untrusted)
if (!secret || got !== secret) {
  return reject(401, 'Unauthorized', 'drop');
}

// 2) Required fields
const required = ['content_id', 'platforms', 'post_type', 'caption', 'status_callback_url'];
for (const f of required) {
  if (body[f] === undefined || body[f] === null || body[f] === '') {
    return reject(422, 'Missing required field: ' + f, 'reject_callback');
  }
}

const platforms = Array.isArray(body.platforms) ? body.platforms : [];
const type = body.post_type;
const media = Array.isArray(body.media_urls) ? body.media_urls : [];
const needsMedia = ['image', 'carousel', 'reel', 'story'].includes(type);
if (needsMedia && !body.media_url && media.length === 0) {
  return reject(422, 'Missing media for post_type ' + type, 'reject_callback');
}
if (platforms.includes('facebook') && !body.facebook_page_id) {
  return reject(422, 'Missing facebook_page_id', 'reject_callback');
}
if (platforms.includes('instagram') && !body.instagram_account_id) {
  return reject(422, 'Missing instagram_account_id', 'reject_callback');
}

// 3) Dedup via workflow static data
const sd = this.getWorkflowStaticData('global');
sd.seen = sd.seen || {};
const prev = sd.seen[body.content_id];
if (prev && (prev.status === 'publishing' || prev.status === 'published')) {
  return reject(409, 'Duplicate publish attempt blocked', 'reject_callback');
}
sd.seen[body.content_id] = { status: 'publishing', started_at: new Date().toISOString() };

// 4) Accepted — normalized payload for the publish step
return [{ json: {
  route: 'publish',
  httpStatus: 200,
  accepted: true,
  content_id: body.content_id,
  brand: body.brand || '',
  product: body.product || '',
  platforms,
  post_type: type,
  caption: body.caption,
  media_url: body.media_url || '',
  media_urls: media,
  facebook_page_id: body.facebook_page_id || '',
  instagram_account_id: body.instagram_account_id || '',
  callback_url: body.status_callback_url,
} }];
