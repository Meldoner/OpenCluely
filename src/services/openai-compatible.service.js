const { request } = require('./ai-http');
const { getAISettings } = require('../core/ai-settings');

function toMessages(geminiRequest) {
  const messages = [];
  const system = geminiRequest.systemInstruction?.parts?.map(part => part.text || '').join('\n');
  if (system) messages.push({ role: 'system', content: system });
  for (const item of geminiRequest.contents || []) {
    const content = (item.parts || []).map(part => {
      if (part.inlineData) return { type: 'image_url', image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } };
      return { type: 'text', text: part.text || '' };
    });
    const role = item.role === 'model' ? 'assistant' : 'user';
    messages.push({ role, content: content.every(part => part.type === 'text') ? content.map(part => part.text).join('\n') : content });
  }
  return messages;
}

async function complete(geminiRequest, onDelta, settings = getAISettings()) {
  if (!settings.configured) throw new Error('Configure the selected AI provider in Settings.');
  const body = { model: settings.model, messages: toMessages(geminiRequest), stream: typeof onDelta === 'function' };
  // Gemma 4 otherwise spends a short request's entire budget on hidden reasoning.
  // Cloudflare documents this template option for its Gemma 4 deployment.
  if (settings.provider === 'cloudflare' && /^@cf\/google\/gemma-4(?:-|\/)/.test(settings.model)) {
    body.chat_template_kwargs = { enable_thinking: false };
  }
  const limit = geminiRequest.generationConfig?.maxOutputTokens || 4096;
  if (settings.provider === 'openai' && new URL(settings.baseUrl).hostname === 'api.openai.com') body.max_completion_tokens = limit;
  else body.max_tokens = limit;
  let fullText = '';
  let finished = false;
  let finishReason = null;
  const result = await request(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    apiKey: settings.apiKey, body,
    onEvent: body.stream ? data => {
      if (data === '[DONE]') { finished = true; return; }
      const chunk = JSON.parse(data);
      if (chunk.error) throw new Error('AI stream returned an error');
      const choice = chunk.choices?.[0];
      const delta = choice?.delta?.content || chunk.response || '';
      if (choice?.finish_reason) { finished = true; finishReason = choice.finish_reason; }
      if (typeof delta === 'string' && delta) { fullText += delta; onDelta(delta); }
    } : undefined
  });
  // Some compatible endpoints return JSON even when stream=true.
  if (result) {
    fullText = result.choices?.[0]?.message?.content || result.result?.response || result.response || '';
    finishReason = result.choices?.[0]?.finish_reason;
    if (typeof fullText !== 'string') throw new Error('AI endpoint returned an unsupported response');
    if (onDelta && fullText) onDelta(fullText);
    finished = true;
  }
  if (body.stream && !finished) throw new Error('AI stream ended before completion');
  if (!fullText.trim()) {
    const error = new Error(finishReason === 'length'
      ? 'The model exhausted its token budget before producing an answer. Increase the output limit or disable reasoning.'
      : 'AI endpoint returned no text. Check model capabilities.');
    error.code = finishReason === 'length' ? 'TOKEN_LIMIT' : 'EMPTY_RESPONSE';
    throw error;
  }
  return fullText.trim();
}

module.exports = { complete, toMessages };
