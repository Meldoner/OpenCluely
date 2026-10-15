const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const live = require('../src/services/gemini-live.service');
const { getAISettings, DEFAULTS } = require('../src/core/ai-settings');
const config = require('../src/core/config');
const { promptLoader } = require('../prompt-loader');
const transcribeLanguages = require('../src/core/gemini-transcribe-languages');
const tick = () => new Promise(resolve => setImmediate(resolve));
const silentLogger = { debug() {}, info() {}, warn() {}, error() {}, logPerformance() {} };

class Transport extends EventEmitter {
  constructor({ setup = true, answer, final } = {}) {
    super(); this.messages = []; this.autoSetup = setup; this.answer = answer; this.final = final;
  }
  start(url) { this.url = url; queueMicrotask(() => this.emit('open')); }
  send(message) {
    this.messages.push(message);
    if (message.setup && this.autoSetup) queueMicrotask(() => this.emit('message', { setupComplete: {} }));
    if (message.clientContent && this.answer) queueMicrotask(() => this.answer(this));
    if ((message.realtimeInput?.activityEnd || message.realtimeInput?.audioStreamEnd) && this.final) {
      queueMicrotask(() => this.content({ inputTranscription: { text: this.final } }));
    }
  }
  content(content) { this.emit('message', { serverContent: content }); }
  close() { this.closed = true; }
}
const sessionOptions = transport => ({ apiKey: 'test-key', transport, timeoutMs: 1000 });

test('Transcribe Live language hints normalize, support multiple codes and preserve automatic defaults', async () => {
  assert.deepEqual(transcribeLanguages.parse(' RU-ru, en-us,ru-RU '), ['ru-RU', 'en-US']);
  assert.deepEqual(transcribeLanguages.parse('auto'), []);
  assert.deepEqual(transcribeLanguages.parse(), []);
  for (const value of ['ru', ['not-a-language'], [null], 'en-US\nru-RU', ['auto', 'ru-RU']]) assert.throws(() => transcribeLanguages.parse(value));
  const transport = new Transport();
  const session = live.createTranscription({ ...sessionOptions(transport), languageCodes: ['ru-RU', 'en-US'] });
  await session.connect();
  assert.deepEqual(transport.messages[0].setup.inputAudioTranscription.languageCodes, ['ru-RU', 'en-US']);
  session.close();
  const automatic = live.createTranscription({ ...sessionOptions(new Transport()), languageCodes: [] });
  assert.deepEqual(automatic.setup.inputAudioTranscription.languageCodes, []);
  automatic.close();
});

test('standalone PCM script reads saved language hints and allows explicit lists or auto to override them', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/aistudio-live.js'), 'utf8');
  async function run(extra) {
    let supplied;
    const session = new EventEmitter();
    Object.assign(session, { async connect() {}, send() {}, sendAudio() {}, async finish() {}, close() {} });
    let exit;
    const done = new Promise(resolve => { exit = resolve; });
    const app = { commandLine: { appendSwitch() {} }, whenReady: () => Promise.resolve(), exit };
    vm.runInNewContext(source, {
      process: { argv: ['electron', 'aistudio-live.js', '--env', 'settings.env', '--pcm', 'audio.pcm', ...extra], env: {}, on() {}, stdout: { write() {} } },
      console: { log() {}, error() {} }, setTimeout: callback => callback(),
      require: name => {
        if (name === 'electron') return { app };
        if (name === 'fs') return { statSync: () => ({ isFile: () => true, size: 3200 }), readFileSync: () => Buffer.alloc(3200) };
        if (name === 'dotenv') return { parse: () => ({ GEMINI_API_KEY: 'test-key', GEMINI_TRANSCRIBE_LANGUAGES: 'ru-RU,en-US' }) };
        if (name.includes('gemini-transcribe-languages')) return transcribeLanguages;
        if (name.includes('gemini-live.service')) return { createTranscription: options => { supplied = options; return session; }, shutdown() {} };
        assert.fail(name);
      }
    });
    assert.equal(await done, 0);
    return supplied.languageCodes;
  }
  assert.deepEqual(await run([]), ['ru-RU', 'en-US']);
  assert.deepEqual(await run(['--languages', 'fr-FR,de-DE']), ['fr-FR', 'de-DE']);
  assert.deepEqual(await run(['--languages', 'auto']), []);
});

test('Live provider shares Gemini credentials and selects the requested model', () => {
  const settings = getAISettings({ LLM_PROVIDER: 'gemini-live', GEMINI_API_KEY: 'test-key' });
  assert.equal(settings.configured, true);
  assert.equal(settings.model, 'gemini-3.8-live');
  assert.equal(settings.apiKey, 'test-key');
  assert.equal(getAISettings({ LLM_PROVIDER: 'gemini-live', GEMINI_API_KEY: 'your_key' }).configured, false);
});

test('transcription waits for setup and sends PCM without a WAV wrapper', async () => {
  const transport = new Transport({ setup: false });
  const session = live.createTranscription(sessionOptions(transport));
  const connecting = session.connect();
  await tick();
  assert.equal(session.ready, false);
  assert.throws(() => session.sendAudio(Buffer.alloc(3200)), /ready Live session/);
  assert.equal(transport.messages[0].setup.model, `models/${DEFAULTS.geminiLiveTranscribeModel}`);
  assert.deepEqual(transport.messages[0].setup.generationConfig.responseModalities, ['TEXT']);
  transport.emit('message', { setupComplete: {} });
  await connecting;
  const pcm = Buffer.alloc(3200, 1);
  session.sendAudio(pcm);
  assert.deepEqual(transport.messages[1].realtimeInput.audio, { data: pcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' });
  session.close();
  assert.equal(transport.closed, true);
});

test('parallel Live answers preserve history, images and system prompts without mixing deltas', async () => {
  const transports = ['First', 'Second'].map(answer => new Transport({ answer: transport => {
    transport.content({ outputTranscription: { text: answer } });
    transport.content({ modelTurn: { parts: [{ thought: true, text: 'hidden reasoning' }] } });
    transport.content({ turnComplete: true, interactionStatus: 'IN_PROGRESS' });
    transport.content({ outputTranscription: { text: ' answer' } });
    transport.content({ turnComplete: true, interactionStatus: 'IDLE' });
  } }));
  const request = { systemInstruction: { parts: [{ text: 'Reply briefly in Russian.' }] }, contents: [
    { role: 'user', parts: [{ text: 'Previous question' }] },
    { role: 'model', parts: [{ text: 'Previous answer' }] },
    { role: 'user', parts: [{ text: 'Current question' }, { inlineData: { data: 'aW1hZ2U=', mimeType: 'image/png' } }] }
  ], generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 4096 } };
  const deltas = [[], []];
  const results = await Promise.all(transports.map((transport, i) => live.complete(request, delta => deltas[i].push(delta), sessionOptions(transport))));
  assert.deepEqual(results, ['First answer', 'Second answer']);
  assert.deepEqual(deltas, [['First', ' answer'], ['Second', ' answer']]);
  for (const transport of transports) {
    const setup = transport.messages[0].setup;
    assert.equal(setup.model, 'models/gemini-3.8-live');
    assert.deepEqual(setup.generationConfig.responseModalities, ['AUDIO']);
    assert.equal(setup.generationConfig.thinkingConfig, undefined);
    assert.deepEqual(setup.outputAudioTranscription, {});
    assert.deepEqual(setup.systemInstruction, request.systemInstruction);
    assert.deepEqual(transport.messages[1].clientContent.turns, request.contents);
    assert.equal(transport.closed, true);
  }
});

test('disconnect after a partial answer fails and closes resources', async () => {
  const transport = new Transport({ answer: transport => {
    transport.content({ outputTranscription: { text: 'Partial' } });
    transport.emit('close', 1006);
  } });
  const deltas = [];
  await assert.rejects(live.complete({ contents: [] }, delta => deltas.push(delta), sessionOptions(transport)), /closed \(1006\)/);
  assert.deepEqual(deltas, ['Partial']);
  assert.equal(transport.closed, true);
});

test('setup timeout, server errors and shutdown reject pending operations', async () => {
  const timeoutTransport = new Transport({ setup: false });
  const session = live.createTranscription({ ...sessionOptions(timeoutTransport), timeoutMs: 10 });
  await assert.rejects(session.connect(), /setup timed out/);
  assert.equal(timeoutTransport.closed, true);
  const errorTransport = new Transport({ setup: false });
  const failed = live.createTranscription(sessionOptions(errorTransport));
  const rejected = assert.rejects(failed.connect(), /Live API error \(403\)/);
  errorTransport.emit('message', { error: { code: 403, message: 'test-key secret echoed' } });
  await rejected;
  const waiting = live.createTranscription(sessionOptions(new Transport({ setup: false })));
  const cancelled = assert.rejects(waiting.connect(), /cancelled/);
  live.shutdown();
  await cancelled;
});

function speechService(manual, transport, audioAnswers = false, languages = '', envOverrides = {}, recoveringTransports = null) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/speech.service.js'), 'utf8');
  const context = {
    EventEmitter, WhisperWorkerService: class { close() {} }, logger: silentLogger, config,
    Buffer, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
    process: { platform: 'win32', env: { GEMINI_API_KEY: 'test-key', GEMINI_TRANSCRIBE_LANGUAGES: languages, LLM_PROVIDER: audioAnswers ? 'gemini-live' : 'openai', SPEECH_PROVIDER: audioAnswers ? 'gemini-live-audio' : 'gemini-live', WHISPER_CAPTURE_MODE: manual ? 'manual' : 'vad', ...envOverrides } },
    require: name => {
      if (name === '../core/ai-settings') return require('../src/core/ai-settings');
      if (name === '../core/gemini-transcribe-languages') return transcribeLanguages;
      if (name === '../core/transcription-vocabulary') return require('../src/core/transcription-vocabulary');
      if (name === './gemini-live.service') return {
        createTranscription: options => live.createTranscription({ ...options, ...sessionOptions(transport) }),
        createRecoveringTranscription: options => recoveringTransports
          ? new (require('../src/services/gemini-transcription-retry.service'))(() => live.createTranscription({ ...options, ...sessionOptions(recoveringTransports.shift()) }), { retryDelayMs: 1, replayDelayMs: 0 })
          : live.createTranscription({ ...options, ...sessionOptions(transport) }),
        createAudioConversation: (request, options) => live.createAudioConversation(request, { ...options, ...sessionOptions(transport) })
      };
      assert.fail('Unexpected dependency: ' + name);
    }
  };
  vm.runInNewContext(source.slice(source.indexOf('class SpeechService extends EventEmitter {'), source.indexOf('module.exports = new SpeechService();')) + '\nthis.Speech = SpeechService;', context);
  const service = new context.Speech();
  service.getLiveAudioRequest = () => ({ contents: [{ role: 'user', parts: [{ text: 'Previous question' }] }],
    systemInstruction: { parts: [{ text: 'Brief backend interview answers' }] }, metadata: { skill: 'backend' } });
  service.on('error', () => {});
  return service;
}

test('automatic Live speech emits interim and finalized text through the existing audio path', async () => {
  const transport = new Transport({ final: 'Last phrase' });
  const service = speechService(false, transport, false, 'ru-RU,en-US');
  const final = []; const interim = [];
  service.on('transcription', text => final.push(text));
  service.on('interim-transcription', text => interim.push(text));
  service.startRecording();
  await tick();
  assert.deepEqual(transport.messages[0].setup.inputAudioTranscription.languageCodes, ['ru-RU', 'en-US']);
  assert.equal(service.isAvailable(), true);
  assert.equal(service.useRendererCapture, true);
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 60));
  transport.content({ interimInputTranscription: { text: 'Preview' } });
  transport.content({ inputTranscription: { text: 'First phrase' } });
  assert.deepEqual(final, ['First phrase']);
  assert.deepEqual(interim, ['Preview', '']);
  const stopped = new Promise(resolve => service.on('status', text => { if (text === 'Recording stopped') resolve(); }));
  service.stopRecording();
  assert.equal(service.isProcessingAudio, true);
  await stopped;
  assert.deepEqual(final, ['First phrase', 'Last phrase']);
  assert.equal(service.isProcessingAudio, false);
  assert.equal(transport.closed, true);
  assert.equal(service.liveLimitTimer, null);
  assert.deepEqual(transport.messages.at(-1), { realtimeInput: { audioStreamEnd: true } });
});

test('manual Live speech waits for the final transcript after Stop and uses activity signals', async t => {
  const transport = new Transport({ final: 'Final question' });
  const service = speechService(true, transport);
  t.after(() => service.shutdown());
  const final = [];
  service.on('transcription', text => final.push(text));
  service.startRecording(); await tick();
  assert.equal(transport.messages[0].setup.realtimeInputConfig.automaticActivityDetection.disabled, true);
  assert.equal(JSON.stringify(transport.messages[1]), JSON.stringify({ realtimeInput: { activityStart: {} } }));
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 60));
  transport.content({ inputTranscription: { text: 'First part' } });
  assert.deepEqual(final, []);
  const stopped = new Promise(resolve => service.on('status', text => { if (text === 'Recording stopped') resolve(); }));
  service.stopRecording(); await stopped;
  assert.deepEqual(final, ['First part Final question']);
  assert.deepEqual(transport.messages.at(-1), { realtimeInput: { activityEnd: {} } });
});

test('Live speech sends the active skill glossary and respects per-skill overrides and empty lists', async () => {
  const examples = { dsa: 'BFS', devops: 'Kubernetes', analyst: 'ARPU', backend: 'MVCC', 'ml-engineer': 'CatBoost', 'ai-engineer': 'KVCache' };
  for (const [skill, term] of Object.entries(examples)) {
    const transport = new Transport();
    const service = speechService(false, transport, false, '', { ACTIVE_SKILL: skill });
    try {
      service.startRecording(); await tick();
      assert.ok(transport.messages[0].setup.inputAudioTranscription.customVocabulary.includes(term), skill);
    } finally { service.shutdown(); }
  }
  for (const value of ['MyModel,KVCache', '']) {
    const transport = new Transport();
    const service = speechService(false, transport, false, '', { ACTIVE_SKILL: 'ai-engineer', GEMINI_TRANSCRIBE_VOCABULARY_AI_ENGINEER: value });
    try {
      service.startRecording(); await tick();
      assert.deepEqual(transport.messages[0].setup.inputAudioTranscription.customVocabulary, value ? ['MyModel', 'KVCache'] : []);
    } finally { service.shutdown(); }
  }
});

test('actual speech capture stays active through Live reconnection and Stop waits for the replayed final phrase', async t => {
  const first = new Transport(), second = new Transport({ final: 'Recovered final phrase' });
  const service = speechService(true, first, false, '', {}, [first, second]);
  t.after(() => service.shutdown());
  const transcripts = [];
  let starts = 0, stops = 0;
  service.on('transcription', text => transcripts.push(text));
  service.on('recording-started', () => starts++);
  service.on('recording-stopped', () => stops++);
  service.startRecording(); await tick();
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 60));
  first.emit('error', new Error('offline'));
  assert.equal(service.isRecording, true);
  const stopped = new Promise(resolve => service.on('status', status => { if (status === 'Recording stopped') resolve(); }));
  service.stopRecording();
  assert.equal(service.isProcessingAudio, true);
  await stopped;
  assert.deepEqual(transcripts, ['Recovered final phrase']);
  assert.equal(second.messages.filter(message => message.realtimeInput?.audio).length, 1);
  assert.equal(starts, 1); assert.equal(stops, 1);
  assert.equal(service.isProcessingAudio, false);
});

test('stopping pending Live setup prevents capture and connection failure stops active capture', async () => {
  const pending = new Transport({ setup: false });
  const service = speechService(false, pending);
  let starts = 0;
  service.on('recording-started', () => starts++);
  service.startRecording(); service.stopRecording(); await tick();
  assert.equal(starts, 0);
  assert.equal(pending.closed, true);
  assert.equal(service.isRecording, false);
  assert.equal(service.isProcessingAudio, false);
  const transport = new Transport();
  const active = speechService(false, transport);
  const errors = [];
  active.on('error', error => errors.push(error));
  active.startRecording(); await tick();
  transport.emit('error', 'test-key');
  assert.equal(active.isRecording, false);
  assert.equal(active.useRendererCapture, false);
  assert.equal(active.liveLimitTimer, null);
  assert.equal(errors.length, 1);
  assert.doesNotMatch(errors[0], /test-key/);
});

test('Live finalization timeout is reported instead of losing pending speech silently', async () => {
  const session = live.createTranscription({ ...sessionOptions(new Transport()), manual: true, finishTimeoutMs: 10 });
  await assert.rejects(session.finish(), /not ready/);
  await session.connect();
  await assert.rejects(session.finish(), /audio finalization timed out/);
  session.close();
  await assert.rejects(session.finish(), /not ready/);
});

test('explicit Gemini 3.8 audio selection routes PCM, transcripts and answers through one model', async t => {
  const transport = new Transport();
  const service = speechService(false, transport, true, 'ru-RU,en-US');
  t.after(() => service.shutdown());
  const transcripts = []; const traditional = []; const events = [];
  service.on('live-transcription', text => transcripts.push(text));
  service.on('transcription', text => traditional.push(text));
  for (const name of ['response-start', 'response-chunk', 'response-complete']) service.on(`live-${name}`, data => events.push({ name, data }));
  service.startRecording(); await tick();
  assert.equal(service.provider, 'gemini-live-audio');
  assert.equal(service.isAvailable(), true);
  const setup = transport.messages[0].setup;
  assert.equal(setup.model, 'models/gemini-3.8-live');
  assert.deepEqual(setup.generationConfig.responseModalities, ['AUDIO']);
  assert.deepEqual(setup.inputAudioTranscription, {});
  assert.deepEqual(setup.outputAudioTranscription, {});
  assert.match(setup.systemInstruction.parts[0].text, /backend interview/);
  assert.equal(setup.historyConfig.initialHistoryInClientContent, true);
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 60));
  assert.equal(transport.messages.at(-1).realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
  transport.content({ inputTranscription: { text: 'Audio question' }, outputTranscription: { text: 'A useful' } });
  transport.content({ outputTranscription: { text: ' answer' }, turnComplete: true, interactionStatus: 'IDLE' });
  assert.deepEqual(transcripts, ['Audio question']);
  assert.deepEqual(traditional, []);
  assert.deepEqual(events.map(event => event.name), ['response-start', 'response-chunk', 'response-chunk', 'response-complete']);
  assert.equal(events[3].data.response, 'A useful answer');
  assert.equal(new Set(events.map(event => event.data.messageId)).size, 1);
  // Only the initial history uses clientContent; the transcript is never resent.
  assert.equal(transport.messages.filter(message => message.clientContent).length, 1);
});

test('Gemini 3.8 answers can use Transcribe Live with language hints, or disable speech entirely', async t => {
  const transport = new Transport();
  const service = speechService(false, transport, false, 'ru-RU,en-US', { LLM_PROVIDER: 'gemini-live' });
  t.after(() => service.shutdown());
  const transcripts = []; const audioAnswers = [];
  service.on('transcription', text => transcripts.push(text));
  service.on('live-transcription', text => audioAnswers.push(text));
  service.getLiveAudioRequest = () => assert.fail('The external transcriber must not open a Gemini 3.8 audio session');
  service.startRecording(); await tick();
  assert.equal(service.provider, 'gemini-live');
  assert.equal(service.usesLiveAudioAnswers(), false);
  assert.equal(transport.messages[0].setup.model, 'models/gemini-3.5-transcribe-live');
  assert.deepEqual(transport.messages[0].setup.inputAudioTranscription.languageCodes, ['ru-RU', 'en-US']);
  transport.content({ inputTranscription: { text: 'Question for Gemini 3.8' } });
  assert.deepEqual(transcripts, ['Question for Gemini 3.8']);
  assert.deepEqual(audioAnswers, []);
  const disabled = speechService(false, new Transport(), false, '', { LLM_PROVIDER: 'gemini-live', SPEECH_PROVIDER: 'disabled' });
  assert.equal(disabled.provider, 'disabled');
  assert.equal(disabled.isAvailable(), false);
});

test('manual Live audio finalization waits for the answer after input transcription, and interruptions retain the response ID', async () => {
  const transport = new Transport();
  const session = live.createAudioConversation({ contents: [] }, { ...sessionOptions(transport), manual: true });
  await session.connect();
  transport.content({ inputTranscription: { text: 'Question' } });
  let completed = false;
  const finished = session.finish({ hasSpeech: false }).then(() => { completed = true; });
  await tick();
  assert.equal(completed, false);
  assert.equal(transport.messages.at(-1).realtimeInput.activityEnd !== undefined, true);
  transport.content({ outputTranscription: { text: 'Answer' } });
  await tick();
  assert.equal(completed, false);
  transport.content({ turnComplete: true, interactionStatus: 'IDLE' });
  await finished;
  const starts = []; const errors = [];
  session.on('response-start', data => starts.push(data));
  session.on('response-error', data => errors.push(data));
  transport.content({ outputTranscription: { text: 'Partial' } });
  transport.content({ interrupted: true });
  assert.equal(errors[0].messageId, starts[0].messageId);
  assert.match(errors[0].error, /interrupted/);
  transport.content({ outputTranscription: { text: 'Another partial answer' } });
  assert.notEqual(starts[0].messageId, starts[1].messageId);
  transport.emit('close', 1006);
  assert.equal(errors[1].messageId, starts[1].messageId);
  assert.match(errors[1].error, /closed/);
  session.close();
});

test('manual Live answers keep recording stopped until the response finishes', async t => {
  const transport = new Transport();
  const service = speechService(true, transport, true);
  t.after(() => service.shutdown());
  service.startRecording(); await tick();
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 60));
  const stopped = new Promise(resolve => service.on('status', text => { if (text === 'Recording stopped') resolve(); }));
  service.stopRecording();
  transport.content({ inputTranscription: { text: 'Question' } });
  await tick();
  assert.equal(service.isRecording, false);
  assert.equal(service.isProcessingAudio, true);
  assert.equal(transport.closed, undefined);
  transport.content({ outputTranscription: { text: 'Answer' }, turnComplete: true, interactionStatus: 'IDLE' });
  await stopped;
  assert.equal(service.isProcessingAudio, false);
  assert.equal(transport.closed, true);
});

test('isolated WebSocket preload decodes messages in order, drops audio and rejects other hosts', async () => {
  const ipc = new EventEmitter();
  const events = [];
  ipc.send = (_channel, type, data) => events.push({ type, data });
  let socket;
  class Socket {
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url) { this.url = url; this.readyState = 1; this.bufferedAmount = 0; socket = this; }
    send(text) { this.sent = text; }
    close(code) { this.closed = true; this.closeCode = code; this.readyState = Socket.CLOSED; this.onclose?.({ code }); }
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/ui/gemini-live-preload.js'), 'utf8');
  const context = { require: () => ({ ipcRenderer: ipc }), URL, WebSocket: Socket, window: { addEventListener() {} } };
  vm.runInNewContext(source, context);
  ipc.emit('gemini-live-connect', {}, 'wss://example.invalid/');
  assert.equal(socket, undefined);
  vm.runInNewContext(source, { ...context });
  ipc.emit('gemini-live-connect', {}, 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=test-key');
  let decode;
  const first = new Promise(resolve => { decode = resolve; });
  socket.onmessage({ data: { text: () => first } });
  socket.onmessage({ data: JSON.stringify({ serverContent: { turnComplete: true } }) });
  await tick();
  assert.equal(events.length, 0);
  decode(JSON.stringify({ serverContent: { outputTranscription: { text: 'Answer' }, modelTurn: { parts: [{ inlineData: { data: 'audio' } }] } } }));
  await tick();
  assert.equal(events[0].data.serverContent.outputTranscription.text, 'Answer');
  assert.equal(events[0].data.serverContent.modelTurn.parts.length, 0);
  assert.equal(events[1].data.serverContent.turnComplete, true);
  socket.bufferedAmount = 2 * 1024 * 1024;
  ipc.emit('gemini-live-send', {}, '{}');
  assert.equal(events.at(-1).type, 'error');
  assert.equal(socket.sent, undefined);
  ipc.emit('gemini-live-close');
  await tick();
  assert.equal(socket.closeCode, 1000);
  assert.equal(events.at(-1).type, 'close');
  assert.equal(events.at(-1).data, 1000);
});

test('LLM routes voice, text and screenshots to Live and never retries partial Live streams', async () => {
  const requests = [];
  let fail = false;
  const context = { module: { exports: {} }, Buffer, process: { env: { DIALOGUE_LANGUAGES: 'ru-RU' } }, require: name => {
    if (name === '@google/genai') return { GoogleGenAI: class {} };
    if (name.includes('logger')) return { createServiceLogger: () => silentLogger };
    if (name === '../core/config') return config;
    if (name === '../core/dialogue-languages') return require('../src/core/dialogue-languages');
    if (name === '../../prompt-loader') return { promptLoader };
    if (name === '../core/ai-settings') return { getAISettings: () => getAISettings({ LLM_PROVIDER: 'gemini-live', GEMINI_API_KEY: 'test-key' }) };
    if (name === './openai-compatible.service') return { complete() { assert.fail('Live must not use Chat Completions'); } };
    if (name === './gemini-live.service') return { complete: async (request, onDelta) => {
      requests.push(request);
      if (onDelta) onDelta('Answer');
      if (fail) throw new Error('Disconnected after partial response');
      return 'Answer';
    } };
    if (name === '../managers/session.manager') return { getConversationHistory: () => [], getSkillContext: (skill, language) => ({
      skillPrompt: promptLoader.getSkillPrompt(skill, language), requiresProgrammingLanguage: promptLoader.requiresProgrammingLanguage(skill)
    }) };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/llm.service.js'), 'utf8'), context);
  const llm = context.module.exports;
  const audioRequest = llm.buildLiveAudioRequest('ai-engineer', 'go');
  assert.match(audioRequest.systemInstruction.parts[0].text, /AI application engineer/);
  assert.match(audioRequest.systemInstruction.parts[0].text, /2-5 short sentences/);
  assert.equal(audioRequest.contents.length, 0);
  await llm.processTextWithSkillStream('What is an index?', 'backend', [], 'go', () => {});
  await llm.processTranscriptionWithIntelligentResponseStream('Explain evals', 'ai-engineer', [], null, () => {});
  await llm.processImageWithSkillStream(Buffer.from('image'), 'image/png', 'analyst', [], null, () => {});
  assert.equal(requests.length, 3);
  for (const request of [audioRequest, ...requests]) assert.match(request.systemInstruction.parts.at(-1).text, /Write answer explanations in Russian/);
  assert.match(requests[0].systemInstruction.parts[0].text, /Live interview response style/);
  assert.match(requests[1].systemInstruction.parts[0].text, /AI application engineer/);
  assert.equal(requests[2].contents[0].parts[1].inlineData.data, Buffer.from('image').toString('base64'));
  fail = true;
  await assert.rejects(llm.processTextWithSkillStream('Question', 'backend', [], null, () => {}), /Disconnected/);
  assert.equal(requests.length, 4);
});
