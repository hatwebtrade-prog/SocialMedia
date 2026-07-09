// Builds the "AGOCAP - Meta Auto Publisher" n8n workflow from the Code sources
// in ./src, writes the importable JSON, and (with --deploy) creates it via the
// n8n public API. Usage: node n8n/build.mjs [--deploy]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = (f) => readFileSync(path.join(__dirname, 'src', f), 'utf8');

// --- read N8N_API_URL / N8N_API_KEY from .env ---
function readEnv() {
  const env = {};
  try {
    const raw = readFileSync(path.join(root, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

const code = (name, file, x, y) => ({
  parameters: { mode: 'runOnceForAllItems', jsCode: src(file) },
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [x, y],
});

const switchRule = (value) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
    conditions: [{ id: 'rule-' + value, leftValue: '={{ $json.route }}', rightValue: value, operator: { type: 'string', operation: 'equals' } }],
    combinator: 'and',
  },
  renameOutput: true,
  outputKey: value,
});

const nodes = [
  {
    parameters: { httpMethod: 'POST', path: 'agocap-meta-publish', responseMode: 'responseNode', options: {} },
    id: 'webhook-receive',
    name: 'Webhook - Receive Approved Meta Content',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [0, 300],
    webhookId: 'agocap-meta-publish',
  },
  code('Validate, Auth & Dedup', 'validate.js', 240, 300),
  {
    parameters: {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify({ accepted: $json.accepted, error: $json.error_message || null }) }}',
      options: { responseCode: '={{ $json.httpStatus }}' },
    },
    id: 'respond-webhook',
    name: 'Respond to Webhook',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [480, 300],
  },
  {
    parameters: { rules: { values: [switchRule('publish'), switchRule('reject_callback'), switchRule('drop')] }, options: {} },
    id: 'route',
    name: 'Route',
    type: 'n8n-nodes-base.switch',
    typeVersion: 3,
    position: [720, 300],
  },
  code('Publish to Meta', 'publish.js', 960, 200),
  code('Build Reject Callback', 'buildReject.js', 960, 420),
  {
    parameters: {
      method: 'POST',
      url: '={{ $json.callback_url }}',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-agocap-secret', value: '={{ $env.AGOCAP_N8N_SECRET }}' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.callbackBody) }}',
      options: {},
    },
    id: 'callback-agocap',
    name: 'Callback to AGOCAP',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1200, 300],
    onError: 'continueRegularOutput',
  },
];

const c = (node) => ({ node, type: 'main', index: 0 });
const connections = {
  'Webhook - Receive Approved Meta Content': { main: [[c('Validate, Auth & Dedup')]] },
  'Validate, Auth & Dedup': { main: [[c('Respond to Webhook')]] },
  'Respond to Webhook': { main: [[c('Route')]] },
  'Route': { main: [[c('Publish to Meta')], [c('Build Reject Callback')], []] },
  'Publish to Meta': { main: [[c('Callback to AGOCAP')]] },
  'Build Reject Callback': { main: [[c('Callback to AGOCAP')]] },
};

const workflow = { name: 'AGOCAP - Meta Auto Publisher', nodes, connections, settings: { executionOrder: 'v1' } };

const outFile = path.join(__dirname, 'agocap-meta-auto-publisher.json');
writeFileSync(outFile, JSON.stringify(workflow, null, 2));
console.log('Wrote', outFile, '(' + nodes.length + ' nodes)');

if (process.argv.includes('--deploy')) {
  const env = readEnv();
  const url = env.N8N_API_URL;
  const key = env.N8N_API_KEY;
  if (!url || !key) { console.error('N8N_API_URL / N8N_API_KEY mancanti nel .env'); process.exit(1); }
  const res = await fetch(url.replace(/\/$/, '') + '/api/v1/workflows', {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(workflow),
  });
  const text = await res.text();
  console.log('Deploy HTTP', res.status);
  try {
    const j = JSON.parse(text);
    if (j.id) console.log('Created workflow id:', j.id, '| name:', j.name);
    else console.log(text.slice(0, 800));
  } catch { console.log(text.slice(0, 800)); }
}
