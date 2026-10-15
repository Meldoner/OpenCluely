const https = require('https');
const http = require('http');

function validateEndpoint(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password) {
    throw new Error('AI endpoint must use HTTPS (HTTP is allowed only for localhost).');
  }
  return url;
}

// Handles LF/CRLF framing, multiline data and UTF-8 split across network chunks.
class SSEDecoder {
  constructor(onEvent) { this.buffer = ''; this.onEvent = onEvent; }
  write(chunk) {
    this.buffer += chunk;
    let boundary;
    while ((boundary = /\r?\n\r?\n/.exec(this.buffer))) {
      const event = this.buffer.slice(0, boundary.index);
      this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
      this.emit(event);
    }
  }
  emit(event) {
    const data = event.split(/\r?\n/).filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (data) this.onEvent(data);
  }
  end() { if (this.buffer.trim()) this.emit(this.buffer); this.buffer = ''; }
}

function redactProviderMessage(value, apiKey, body) {
  let message = String(value || '');
  const privateValues = [apiKey];
  if (body && !Buffer.isBuffer(body)) {
    if (typeof body.prompt === 'string') privateValues.push(body.prompt);
    for (const item of body.messages || []) {
      if (typeof item.content === 'string') privateValues.push(item.content);
      else for (const part of item.content || []) privateValues.push(part.text, part.image_url?.url);
    }
    if (typeof body.audio === 'string') privateValues.push(body.audio);
  }
  for (const secret of privateValues) if (secret) message = message.split(secret).join('[redacted]');
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/[A-Za-z0-9+/=_-]{80,}/g, '[redacted data]').slice(0, 350);
}

function apiError(raw, status, apiKey, body) {
  let payload;
  try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { payload = {}; }
  const details = Array.isArray(payload?.errors) && payload.errors.length ? payload.errors
    : payload?.error ? [typeof payload.error === 'string' ? { message: payload.error } : payload.error] : [];
  const detail = details.map(item => [item.code, redactProviderMessage(item.message, apiKey, body)].filter(Boolean).join(': ')).join('; ');
  const error = new Error(`AI API HTTP ${status}${detail ? ': ' + detail : '. Check credentials, model and quota.'}`);
  error.status = status;
  error.code = details[0]?.code;
  return error;
}

function networkError(original) {
  const code = original?.code || original?.cause?.code || String(original?.message || '').match(/(?:net::)?(ERR_[A-Z_]+)/)?.[1] || 'NETWORK_ERROR';
  const error = new Error(`Cannot reach the AI endpoint (${code}). Check your network and system proxy settings.`);
  error.code = code;
  return error;
}

function electronFetch() {
  if (!process.versions?.electron) return null;
  const { app, net } = require('electron');
  return app?.isReady() && typeof net?.fetch === 'function' ? net.fetch.bind(net) : null;
}

// Chromium follows system proxy/PAC settings. Native Node HTTPS does not.
async function requestWithFetch(fetchImpl, url, { apiKey, body, payload, contentType, timeout, onEvent, signal }) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  const deadline = setTimeout(() => controller.abort(), timeout);
  let reader;
  try {
    let response;
    try {
      response = await fetchImpl(url.href, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': contentType },
        body: payload, redirect: 'error', signal: controller.signal });
    } catch (error) { throw networkError(error); }
    const streaming = response.ok && onEvent && String(response.headers.get('content-type')).includes('text/event-stream');
    const decoder = streaming ? new SSEDecoder(onEvent) : null;
    const utf8 = new TextDecoder();
    let raw = '';
    let bytes = 0;
    reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) throw new Error('AI response exceeds size limit');
        const text = utf8.decode(value, { stream: true });
        if (decoder) decoder.write(text); else raw += text;
      }
      const finalText = utf8.decode();
      if (decoder) decoder.write(finalText); else raw += finalText;
    }
    if (!response.ok) throw apiError(raw, response.status, apiKey, body);
    if (decoder) { decoder.end(); return null; }
    const result = JSON.parse(raw);
    if (result.success === false || result.error || result.errors?.length) throw apiError(result, response.status, apiKey, body);
    return result;
  } catch (error) {
    if (signal?.aborted) throw signal.reason || new Error('AI request cancelled');
    if (controller.signal.aborted) throw new Error('AI request timeout');
    if (error instanceof SyntaxError) throw new SyntaxError('Invalid JSON returned by the AI endpoint');
    throw error;
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', onAbort);
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}

function request(urlValue, { apiKey, body, contentType = 'application/json', timeout = 60000, onEvent, fetchImpl, signal } = {}) {
  if (signal?.aborted) return Promise.reject(signal.reason || new Error('AI request cancelled'));
  const url = validateEndpoint(urlValue);
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  const fetchTransport = fetchImpl || electronFetch();
  if (fetchTransport) return requestWithFetch(fetchTransport, url, { apiKey, body, payload, contentType, timeout, onEvent, signal });
  return new Promise((resolve, reject) => {
    let settled = false;
    let req;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal?.removeEventListener('abort', onAbort);
      if (error) { if (req) req.destroy(); reject(error); } else resolve(value);
    };
    const deadline = setTimeout(() => finish(new Error('AI request timeout')), timeout);
    const onAbort = () => finish(signal.reason || new Error('AI request cancelled'));
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      req = (url.protocol === 'https:' ? https : http).request(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': contentType, 'Content-Length': payload.length }
      }, res => {
        res.setEncoding('utf8');
        let raw = '';
        let bytes = 0;
        const success = res.statusCode >= 200 && res.statusCode < 300;
        const streaming = success && onEvent && String(res.headers['content-type']).includes('text/event-stream');
        const decoder = streaming ? new SSEDecoder(onEvent) : null;
        res.on('data', chunk => {
          try {
            bytes += Buffer.byteLength(chunk);
            if (bytes > 8 * 1024 * 1024) throw new Error('AI response exceeds size limit');
            if (decoder) decoder.write(chunk); else raw += chunk;
          } catch (error) { finish(error); }
        });
        res.on('end', () => {
          if (settled) return;
          try {
            if (!success) {
              throw apiError(raw, res.statusCode, apiKey, body);
            }
            if (decoder) { decoder.end(); finish(null, null); }
            else {
              const result = JSON.parse(raw);
              if (result.success === false || result.error || result.errors?.length) throw apiError(result, res.statusCode, apiKey, body);
              finish(null, result);
            }
          } catch (error) { finish(error); }
        });
        res.on('aborted', () => finish(new Error('AI response interrupted')));
        res.on('error', () => finish(new Error('AI response connection failed')));
      });
      req.on('error', error => finish(networkError(error)));
      req.end(payload);
    } catch (_) { finish(new Error('Invalid AI request settings. Check credentials and endpoint.')); }
  });
}

module.exports = { request, validateEndpoint, SSEDecoder };
