const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getAISettings } = require('../src/core/ai-settings');
const { complete, toMessages } = require('../src/services/openai-compatible.service');
const { request, SSEDecoder, validateEndpoint } = require('../src/services/ai-http');
const { PromptLoader } = require('../prompt-loader');
const catalogue = require('../src/core/skills');

async function endpoint(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}/v1`;
}

test('provider selection does not require Gemini when using OpenAI or Cloudflare', () => {
  assert.equal(getAISettings({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key' }).configured, true);
  assert.equal(getAISettings({ LLM_PROVIDER: 'cloudflare', CLOUDFLARE_API_TOKEN: 'test-token', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32) }).configured, true);
  assert.equal(getAISettings({ LLM_PROVIDER: 'cloudflare', OPENAI_API_KEY: 'test-key' }).configured, false);
  assert.equal(getAISettings({ GEMINI_API_KEY: 'your_gemini_api_key_here' }).configured, false);
});

test('every skill loads its own prompt and Go is injected without forcing SQL to Go', () => {
  const loader = new PromptLoader();
  assert.deepEqual(loader.getAvailableSkills(), catalogue.map(skill => skill.id));
  for (const skill of catalogue) assert.ok(loader.getSkillPrompt(skill.id)?.length > 100);
  assert.match(loader.getSkillPrompt('dsa', 'go'), /Go/);
  assert.match(loader.getSkillPrompt('backend', 'go'), /SQL/);
  assert.equal(loader.requiresProgrammingLanguage('analyst'), false);
});

test('conversation roles, system instructions and image bytes survive API conversion', () => {
  const messages = toMessages({ systemInstruction: { parts: [{ text: 'Backend instructions' }] }, contents: [
    { role: 'user', parts: [{ text: 'Question' }] },
    { role: 'model', parts: [{ text: 'Answer' }] },
    { role: 'user', parts: [{ text: 'Screenshot' }, { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] }
  ] });
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[2].role, 'assistant');
  assert.equal(messages[3].content[1].image_url.url, 'data:image/png;base64,aGVsbG8=');
});

test('SSE handles split CRLF delimiters, comments, multiline data and final unframed event', () => {
  const events = [];
  const parser = new SSEDecoder(event => events.push(event));
  for (const part of [': comment\r\n\r\ndata: one\r', '\n\r', '\ndata: two\ndata: three\n\ndata: [DONE]']) parser.write(part);
  parser.end();
  assert.deepEqual(events, ['one', 'two\nthree', '[DONE]']);
});

test('compatible chat sends configured model, bearer key, history and streams deltas', async t => {
  let sent;
  const baseUrl = await endpoint(t, (req, res) => {
    let body = '';
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, 'Bearer test-key');
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      sent = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"Hello "}}]}\r\n');
      res.write('\r\ndata: {"choices":[{"delta":{"content":"world"},"finish_reason":"stop"}]}\n\n');
      res.end('data: [DONE]');
    });
  });
  const deltas = [];
  const answer = await complete({ contents: [{ role: 'user', parts: [{ text: 'Hi' }] }] }, delta => deltas.push(delta),
    { provider: 'openai', configured: true, apiKey: 'test-key', baseUrl, model: 'custom-model' });
  assert.equal(answer, 'Hello world');
  assert.deepEqual(deltas, ['Hello ', 'world']);
  assert.equal(sent.model, 'custom-model');
  assert.equal(sent.stream, true);
});

test('JSON fallback works when compatible server does not stream', async t => {
  const baseUrl = await endpoint(t, (req, res) => res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] })));
  const deltas = [];
  const result = await complete({ contents: [] }, delta => deltas.push(delta), { configured: true, apiKey: 'test-key', baseUrl, model: 'test' });
  assert.equal(result, 'OK');
  assert.deepEqual(deltas, ['OK']);
});

test('incomplete streams fail instead of returning partial answers', async t => {
  const baseUrl = await endpoint(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
  });
  await assert.rejects(complete({ contents: [] }, () => {}, { configured: true, apiKey: 'test', baseUrl, model: 'test' }), /before completion/);
});

test('malformed SSE fails immediately instead of silently dropping a chunk', async t => {
  const baseUrl = await endpoint(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: {broken JSON}\n\n');
  });
  await assert.rejects(complete({ contents: [] }, () => {}, { configured: true, apiKey: 'test', baseUrl, model: 'test' }), SyntaxError);
});

test('HTTP errors do not expose echoed keys and deadlines destroy stalled requests', async t => {
  const baseUrl = await endpoint(t, (req, res) => {
    if (req.url.endsWith('/error')) { res.writeHead(401); res.end('secret-that-must-not-be-logged'); }
  });
  await assert.rejects(request(baseUrl + '/error', { apiKey: 'test', body: {} }), error => error.status === 401 && !error.message.includes('secret-that'));
  await assert.rejects(request(baseUrl + '/stall', { apiKey: 'test', body: {}, timeout: 30 }), /timeout/);
  await assert.rejects(request(baseUrl + '/headers', { apiKey: 'invalid\nheader', body: {} }), /Invalid AI request settings/);
  assert.throws(() => validateEndpoint('http://example.com/v1'), /HTTPS/);
  assert.throws(() => validateEndpoint('https://user:pass@example.com/v1'), /HTTPS/);
});

test('Cloudflare API error codes remain useful while secrets and echoed questions are redacted', async t => {
  const key = 'test-secret-api-token';
  const question = 'private user question';
  const baseUrl = await endpoint(t, (req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, errors: [{ code: 10000, message: `Authentication error: ${key}; input: ${question}` }] }));
  });
  await assert.rejects(request(baseUrl, { apiKey: key, body: { messages: [{ content: question }] } }), error => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 10000);
    assert.match(error.message, /Authentication error/);
    assert.ok(!error.message.includes(key));
    assert.ok(!error.message.includes(question));
    return true;
  });
});

test('Gemma 4 disables hidden thinking for short Cloudflare requests; other models are unchanged', async t => {
  const bodies = [];
  const baseUrl = await endpoint(t, (req, res) => {
    let body = ''; req.on('data', chunk => body += chunk);
    req.on('end', () => { bodies.push(JSON.parse(body)); res.end(JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] })); });
  });
  const settings = { provider: 'cloudflare', configured: true, apiKey: 'test-key', baseUrl, model: '@cf/google/gemma-4-26b-a4b-it' };
  await complete({ contents: [], generationConfig: { maxOutputTokens: 1024 } }, undefined, settings);
  assert.equal(bodies[0].chat_template_kwargs.enable_thinking, false);
  await complete({ contents: [] }, undefined, { ...settings, model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' });
  assert.equal(bodies[1].chat_template_kwargs, undefined);
});

test('empty responses caused by the reasoning token budget report the actual cause', async t => {
  const baseUrl = await endpoint(t, (req, res) => {
    res.end(JSON.stringify({ choices: [{ message: { content: '', reasoning_content: 'hidden reasoning' }, finish_reason: 'length' }] }));
  });
  await assert.rejects(complete({ contents: [] }, undefined, { configured: true, apiKey: 'test-key', baseUrl, model: 'test' }), error => {
    assert.equal(error.code, 'TOKEN_LIMIT');
    assert.match(error.message, /token budget/);
    assert.ok(!error.message.includes('hidden reasoning'));
    return true;
  });
});

test('fetch transport handles split UTF-8 streaming and releases its reader', async () => {
  const bytes = Buffer.from('data: {"choices":[{"delta":{"content":"Привет"}}]}\n\ndata: [DONE]\n\n');
  let events = '';
  const fakeFetch = async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.subarray(i, i + 1));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  };
  await request('https://api.cloudflare.com/test', { apiKey: 'test-key', body: {}, fetchImpl: fakeFetch,
    onEvent: data => { if (data !== '[DONE]') events += JSON.parse(data).choices[0].delta.content; } });
  assert.equal(events, 'Привет');
});

test('Electron automatically uses Chromium networking instead of direct Node HTTPS', async () => {
  let usedFetch = false;
  const context = { module: { exports: {} }, process: { versions: { electron: '29.4.6' } }, Buffer, URL, AbortController, TextDecoder, setTimeout, clearTimeout,
    require: name => {
      if (name === 'electron') return { app: { isReady: () => true }, net: { fetch: async () => { usedFetch = true; return new Response('{"success":true,"result":{"text":"OK"}}'); } } };
      if (['http', 'https'].includes(name)) return { request() { assert.fail('Electron must use the system proxy transport'); } };
      throw new Error(name);
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/ai-http.js'), 'utf8'), context);
  const result = await context.module.exports.request('https://api.cloudflare.com/test', { apiKey: 'test', body: {} });
  assert.equal(usedFetch, true);
  assert.equal(result.result.text, 'OK');
});

test('fetch errors identify proxy failures and deadlines still abort hung connections', async () => {
  await assert.rejects(request('https://api.cloudflare.com/test', { apiKey: 'test', body: {}, fetchImpl: async () => { throw new Error('net::ERR_PROXY_CONNECTION_FAILED'); } }), /ERR_PROXY_CONNECTION_FAILED/);
  await assert.rejects(request('https://api.cloudflare.com/test', { apiKey: 'test', body: {}, timeout: 20,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) }), /timeout/);
});

test('speech cancellation aborts Chromium fetch and native HTTP with the original reason', async t => {
  const reason = Object.assign(new Error('Speech transcription timed out'), { code: 'TRANSCRIPTION_TIMEOUT' });
  const controller = new AbortController();
  let fetchSignal;
  const task = request('https://api.cloudflare.com/test', { apiKey: 'test', body: {}, signal: controller.signal,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      fetchSignal = options.signal;
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }) });
  controller.abort(reason);
  await assert.rejects(task, error => error === reason);
  assert.equal(fetchSignal.aborted, true);

  let fetched = false;
  await assert.rejects(request('https://api.cloudflare.com/test', { body: {}, signal: controller.signal,
    fetchImpl: async () => { fetched = true; } }), error => error === reason);
  assert.equal(fetched, false);

  const baseUrl = await endpoint(t, () => {});
  const nativeController = new AbortController();
  const native = request(baseUrl, { apiKey: 'test', body: {}, signal: nativeController.signal });
  nativeController.abort(reason);
  await assert.rejects(native, error => error === reason);
});

test('Cloudflare Whisper sends a WAV directly; Turbo sends base64 and language', async () => {
  const requests = [];
  const context = { module: { exports: {} }, process: { env: {} }, require: name => {
    if (name === './ai-http') return { request: async (url, options) => { requests.push({ url, options }); return { result: { text: ' recognized speech ' } }; } };
    if (name === '../core/ai-settings') return require('../src/core/ai-settings');
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/cloudflare-speech.service.js'), 'utf8'), context);
  const cloudflare = context.module.exports;
  const credentials = { accountId: 'a'.repeat(32), apiKey: 'test-token', model: '@cf/openai/whisper' };
  const wav = Buffer.from('RIFF test WAV');
  assert.equal(await cloudflare.transcribe(wav, 'ru', credentials), 'recognized speech');
  assert.equal(requests[0].options.body, wav);
  assert.equal(requests[0].options.contentType, 'application/octet-stream');
  assert.match(requests[0].url, /ai\/run\/@cf\/openai\/whisper$/);
  await cloudflare.transcribe(wav, 'ru', { ...credentials, model: '@cf/openai/whisper-large-v3-turbo' });
  assert.equal(requests[1].options.body.audio, wav.toString('base64'));
  assert.equal(requests[1].options.body.language, 'ru');
  assert.equal(requests[1].options.body.task, 'transcribe');
  await cloudflare.transcribe(wav, 'auto', { ...credentials, model: '@cf/openai/whisper-large-v3-turbo' });
  assert.equal(requests[2].options.body.language, undefined);
  assert.equal(requests[2].options.body.task, 'transcribe');
});
