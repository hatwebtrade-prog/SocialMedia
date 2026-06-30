// AGOCAP Meta Auto Publisher — "Build Reject Callback"
// Code node, mode: Run Once for All Items.
// Turns a validation/dedup rejection into a publish_failed callback body.
const d = $input.first().json;
return [{ json: {
  callback_url: d.callback_url,
  callbackBody: {
    content_id: d.content_id,
    status: 'publish_failed',
    error_message: d.error_message,
    failed_at: new Date().toISOString(),
  },
} }];
