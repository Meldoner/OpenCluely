const { request } = require('./ai-http');
const { DEFAULTS, isConfiguredKey } = require('../core/ai-settings');

function getSettings(env = process.env) {
  return { accountId: String(env.CLOUDFLARE_ACCOUNT_ID || '').trim(), apiKey: String(env.CLOUDFLARE_API_TOKEN || '').trim(),
    model: env.CLOUDFLARE_WHISPER_MODEL || DEFAULTS.cloudflareWhisperModel };
}

function isConfigured(settings = getSettings()) {
  return /^[a-f0-9]{32}$/i.test(settings.accountId) && isConfiguredKey(settings.apiKey) &&
    ['@cf/openai/whisper', '@cf/openai/whisper-large-v3-turbo'].includes(settings.model);
}

async function transcribe(wav, language = 'auto', settings = getSettings()) {
  if (!isConfigured(settings)) throw new Error('Configure Cloudflare Account ID, API Token and Whisper model in Settings.');
  const turbo = settings.model.endsWith('whisper-large-v3-turbo');
  const body = turbo ? { audio: wav.toString('base64'), task: 'transcribe', condition_on_previous_text: false } : wav;
  if (turbo && language && !['auto', 'detect'].includes(language)) body.language = language;
  const result = await request(`https://api.cloudflare.com/client/v4/accounts/${settings.accountId}/ai/run/${settings.model}`, {
    apiKey: settings.apiKey, body, contentType: turbo ? 'application/json' : 'application/octet-stream', timeout: 120000
  });
  if (typeof result.result?.text !== 'string') throw new Error('Cloudflare Whisper returned no transcription field');
  return result.result.text.trim();
}

module.exports = { getSettings, isConfigured, transcribe };
