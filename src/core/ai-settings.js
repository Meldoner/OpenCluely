// Shared by runtime configuration and first-run detection. No SDK side effects.
const DEFAULTS = {
  geminiLiveModel: 'gemini-3.8-live',
  geminiLiveTranscribeModel: 'gemini-3.5-transcribe-live',
  geminiTranscribeLanguages: '',
  openaiModel: 'gpt-4o-mini',
  openaiBaseUrl: 'https://api.openai.com/v1',
  cloudflareModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  cloudflareWhisperModel: '@cf/openai/whisper'
};

function isConfiguredKey(value) {
  const key = String(value || '').trim();
  return Boolean(key && !/^your[_-]|^placeholder/i.test(key));
}

function getAISettings(env = process.env) {
  const provider = env.LLM_PROVIDER || 'gemini';
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiKey = provider === 'cloudflare' ? env.CLOUDFLARE_API_TOKEN
    : provider === 'openai' ? env.OPENAI_API_KEY : env.GEMINI_API_KEY;
  return {
    provider,
    apiKey: String(apiKey || '').trim(),
    accountId,
    model: provider === 'cloudflare' ? (env.CLOUDFLARE_MODEL || DEFAULTS.cloudflareModel)
      : provider === 'openai' ? (env.OPENAI_MODEL || DEFAULTS.openaiModel)
        : provider === 'gemini-live' ? DEFAULTS.geminiLiveModel : null,
    baseUrl: provider === 'cloudflare'
      ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1`
      : (env.OPENAI_BASE_URL || DEFAULTS.openaiBaseUrl),
    configured: ['gemini', 'gemini-live', 'openai', 'cloudflare'].includes(provider) &&
      isConfiguredKey(apiKey) && (provider !== 'cloudflare' || /^[a-f0-9]{32}$/i.test(accountId))
  };
}

module.exports = { DEFAULTS, getAISettings, isConfiguredKey };
