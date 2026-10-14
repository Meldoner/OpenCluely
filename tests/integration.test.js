const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const FirstRunManager = require('../src/core/first-run');
const config = require('../src/core/config');
const { validateEndpoint } = require('../src/services/ai-http');
const { configureNetworkSession } = require('../src/core/network-session');
const catalogue = require('../src/core/skills');
const { promptLoader } = require('../prompt-loader');
const silentLogger = { debug() {}, info() {}, warn() {}, error() {}, logPerformance() {} };

test('OpenAI routing preserves skill expertise for both voice and typed questions', async () => {
  const requests = [];
  const context = { module: { exports: {} }, process: { env: {} }, require: name => {
    if (name === '@google/genai') return { GoogleGenAI: class {} };
    if (name.includes('logger')) return { createServiceLogger: () => silentLogger };
    if (name === '../core/config') return config;
    if (name === '../../prompt-loader') return { promptLoader };
    if (name === '../core/ai-settings') return { getAISettings: () => ({ provider: 'openai', configured: true, model: 'test-model' }) };
    if (name === './openai-compatible.service') return { complete: async (request, onDelta) => {
      requests.push(request);
      if (onDelta) onDelta('A useful answer');
      return 'A useful answer';
    } };
    if (name === '../managers/session.manager') return {
      getConversationHistory: () => [],
      getSkillContext: (skill, language) => ({ skillPrompt: promptLoader.getSkillPrompt(skill, language), requiresProgrammingLanguage: promptLoader.requiresProgrammingLanguage(skill) })
    };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/llm.service.js'), 'utf8'), context);
  const llm = context.module.exports;
  const deltas = [];
  await llm.processTranscriptionWithIntelligentResponseStream('How do I evaluate an ML model?', 'ml-engineer', [], 'go', delta => deltas.push(delta));
  await llm.processTextWithSkillStream('Define retention', 'analyst', [], null, () => {});
  assert.equal(llm.provider, 'openai');
  assert.equal(llm.isInitialized, true);
  assert.match(requests[0].systemInstruction.parts[0].text, /machine learning engineering assistant/);
  assert.match(requests[0].systemInstruction.parts[0].text, /Go/);
  assert.match(requests[1].systemInstruction.parts[0].text, /product, data, business and systems/);
  assert.deepEqual(deltas, ['A useful answer']);
  const connection = await llm.testConnection();
  assert.equal(connection.success, true);
  assert.ok(requests[2].generationConfig.maxOutputTokens >= 1024);
  assert.equal(llm.enforceProgrammingLanguage('```sql\nSELECT 1;\n```', 'go'), '```sql\nSELECT 1;\n```');
});

function mainController(env = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('class ApplicationController {');
  const end = source.indexOf('\n}\n', start) + 2;
  const broadcasts = [];
  const speechService = { isRecording: false, isProcessingAudio: false, initializeClient() { this.initializations = (this.initializations || 0) + 1; }, isAvailable: () => true };
  const llmService = { initializeClient() { this.initializations = (this.initializations || 0) + 1; } };
  const context = { process: { env }, skills: catalogue, config, validateEndpoint, configureNetworkSession, logger: silentLogger,
    speechService, llmService, sessionManager: { setActiveSkill(skill) { this.skill = skill; } },
    windowManager: { broadcastToAllWindows: (channel, data) => broadcasts.push({ channel, data }) },
    require, Buffer, path, fs, formatEnvValue: value => String(value), ENV_PATH: 'unused' };
  vm.runInNewContext(source.slice(start, end) + '\nthis.Controller = ApplicationController;', context);
  const controller = Object.create(context.Controller.prototype);
  controller.activeSkill = 'dsa'; controller.codingLanguage = 'cpp';
  controller.persistEnvUpdates = updates => { Object.assign(env, updates); return Object.keys(updates); };
  return { controller, context, broadcasts };
}

test('application network setup delegates non-Gemini TLS verification to Chromium', () => {
  const { controller, context } = mainController();
  let verifyCertificate;
  let beforeSendHeaders;
  context.session = { defaultSession: {
    webRequest: { onBeforeSendHeaders: handler => { beforeSendHeaders = handler; } },
    setCertificateVerifyProc: handler => { verifyCertificate = handler; }
  } };
  controller.setupNetworkConfiguration();
  for (const hostname of ['api.cloudflare.com', 'api.openai.com', 'untrusted.example']) {
    for (const verificationResult of ['OK', 'CERT_AUTHORITY_INVALID']) {
      let result;
      verifyCertificate({ hostname, verificationResult }, code => { result = code; });
      assert.equal(result, -3, `${hostname} must use Chromium verification, not an unconditional rejection or acceptance`);
    }
  }
  const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
  beforeSendHeaders({ url: 'https://api.cloudflare.com/client/v4/test', requestHeaders: headers }, response => {
    assert.equal(response.requestHeaders, headers);
    assert.equal(response.requestHeaders['User-Agent'], undefined);
  });
});

test('typed responses broadcast deltas before completion and keep the same ID through final display or failure', async () => {
  const { controller, context, broadcasts } = mainController();
  const displayed = [];
  context.sessionManager.addUserInput = () => {};
  context.sessionManager.addModelResponse = () => {};
  context.sessionManager.addConversationEvent = () => {};
  context.windowManager.showLLMLoading = () => {};
  context.windowManager.hideLLMResponse = () => {};
  context.windowManager.showLLMResponse = (text, metadata) => displayed.push({ text, metadata });
  let finish;
  context.llmService.processTextWithSkillStream = async (_text, _skill, _history, _language, onDelta) => {
    onDelta('Partial');
    return new Promise(resolve => { finish = resolve; });
  };
  const processing = controller.processWithLLM('Test request', { recent: [] });
  const start = broadcasts.find(item => item.channel === 'transcription-llm-response-start');
  const delta = broadcasts.find(item => item.channel === 'transcription-llm-response-chunk');
  assert.equal(delta.data.messageId, start.data.messageId);
  assert.equal(delta.data.delta, 'Partial');
  assert.ok(!broadcasts.some(item => item.channel === 'transcription-llm-response'));
  finish({ response: 'Final corrected answer', metadata: {} });
  await processing;
  assert.equal(broadcasts.find(item => item.channel === 'transcription-llm-response').data.messageId, start.data.messageId);
  assert.equal(displayed[0].metadata.messageId, start.data.messageId);
  broadcasts.length = 0;
  context.llmService.processTextWithSkillStream = async () => { throw new Error('Connection interrupted'); };
  await controller.processWithLLM('Failing request', { recent: [] });
  const failedStart = broadcasts.find(item => item.channel === 'transcription-llm-response-start');
  assert.equal(broadcasts.find(item => item.channel === 'llm-error').data.messageId, failedStart.data.messageId);
});

test('saving OpenAI and Cloudflare settings initializes services, persists Go and syncs skill context', () => {
  const { controller, context, broadcasts } = mainController();
  const result = controller.saveSettings({ llmProvider: 'openai', openaiKey: 'test-key', openaiModel: 'custom',
    openaiBaseUrl: 'https://api.openai.com/v1', speechProvider: 'cloudflare',
    cloudflareAccountId: 'a'.repeat(32), cloudflareToken: 'test-token', cloudflareWhisperModel: '@cf/openai/whisper',
    activeSkill: 'backend', codingLanguage: 'go' });
  assert.equal(result.success, true);
  assert.equal(context.process.env.OPENAI_API_KEY, 'test-key');
  assert.equal(context.process.env.ACTIVE_SKILL, 'backend');
  assert.equal(context.process.env.CODING_LANGUAGE, 'go');
  assert.equal(context.sessionManager.skill, 'backend');
  assert.equal(context.llmService.initializations, 1);
  assert.equal(context.speechService.initializations, 1);
  assert.ok(broadcasts.some(item => item.channel === 'skill-changed' && item.data.skill === 'backend'));
});

test('invalid settings and speech changes during capture leave current configuration intact', () => {
  const { controller, context } = mainController({ SPEECH_PROVIDER: 'whisper' });
  assert.equal(controller.saveSettings({ llmProvider: 'unknown' }).success, false);
  assert.equal(controller.saveSettings({ openaiBaseUrl: 'http://remote.example/v1' }).success, false);
  assert.equal(controller.saveSettings({ activeSkill: 'missing' }).success, false);
  context.speechService.isRecording = true;
  assert.equal(controller.saveSettings({ speechProvider: 'cloudflare' }).success, false);
  assert.equal(context.process.env.SPEECH_PROVIDER, 'whisper');
  assert.equal(controller.saveSettings({ codingLanguage: 'go' }).success, true);
});

test('a failed config write does not update runtime credentials', () => {
  const { controller, context } = mainController({ OPENAI_API_KEY: 'old-test-key' });
  delete controller.persistEnvUpdates;
  context.require = name => {
    if (name === 'fs') return { readFileSync: () => 'OPENAI_API_KEY=old-test-key', writeFileSync() { throw new Error('read only'); } };
    return require(name);
  };
  assert.equal(controller.saveSettings({ openaiKey: 'new-test-key' }).success, false);
  assert.equal(context.process.env.OPENAI_API_KEY, 'old-test-key');
});

test('first-run accepts the selected OpenAI provider without a Gemini key', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opencluely-onboarding-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, '.env');
  const sentinelPath = path.join(directory, 'completed');
  fs.writeFileSync(envPath, 'LLM_PROVIDER=openai\nOPENAI_API_KEY=test-key\n');
  fs.writeFileSync(sentinelPath, 'completed');
  const manager = new FirstRunManager({ envPath, sentinelPath });
  assert.equal(manager.needsOnboarding(), false);
  assert.equal(manager.getStatus().llmConfigured, true);
  fs.writeFileSync(envPath, 'LLM_PROVIDER=cloudflare\nCLOUDFLARE_API_TOKEN=test-token\n');
  assert.equal(manager.needsOnboarding(), true);
});

function speechService(transcribe = async () => 'A question', sdk = null) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/speech.service.js'), 'utf8');
  const start = source.indexOf('class SpeechService extends EventEmitter {');
  const end = source.indexOf('module.exports = new SpeechService();');
  let workerCalls = 0;
  class Worker {
    isConfigured() { return true; }
    warmup() { workerCalls++; return Promise.resolve({}); }
    releaseWhenIdle() {} close() {}
  }
  const context = { EventEmitter, WhisperWorkerService: Worker, logger: silentLogger, config, sdk, Buffer, require,
    fs, os, path, spawnSync() { assert.fail('Cloudflare must not probe a local executable'); },
    process: { env: { SPEECH_PROVIDER: 'cloudflare', WHISPER_CAPTURE_MODE: 'manual' }, platform: 'win32' },
    cloudflareSpeech: { isConfigured: () => true, transcribe }, startNativeCapture() { assert.fail('Windows must use renderer system audio'); },
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate };
  vm.runInNewContext(source.slice(start, end) + '\nthis.Speech = SpeechService;', context);
  const service = new context.Speech();
  service.on('error', () => {});
  return { service, workerCalls: () => workerCalls };
}

test('Cloudflare capture works without Python and uploads a valid WAV after stop', async () => {
  let uploaded;
  const { service, workerCalls } = speechService(async wav => { uploaded = wav; return 'A backend question'; });
  const transcripts = [];
  service.on('transcription', text => transcripts.push(text));
  service.startRecording();
  assert.equal(service.useRendererCapture, true);
  assert.equal(workerCalls(), 0);
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 1));
  const stopped = new Promise(resolve => service.on('status', text => { if (text === 'Recording stopped') resolve(); }));
  service.stopRecording();
  await stopped;
  assert.equal(uploaded.toString('ascii', 0, 4), 'RIFF');
  assert.equal(uploaded.readUInt32LE(24), 16000);
  assert.equal(uploaded.readUInt16LE(22), 1);
  assert.equal(uploaded.length, 3244);
  assert.deepEqual(transcripts, ['A backend question']);
  assert.equal(service.isProcessingAudio, false);
});

test('stop waits for in-flight transcription and queued final audio before clearing state', async () => {
  let resolveFirst;
  let calls = 0;
  const { service } = speechService(async () => {
    calls++;
    if (calls === 1) return new Promise(resolve => resolveFirst = resolve);
    return 'Final question';
  });
  const transcripts = [];
  service.on('transcription', text => transcripts.push(text));
  service.startRecording();
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 1));
  const first = service._flushWhisperSegment({ final: false });
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 2));
  const stopped = new Promise(resolve => service.on('status', text => { if (text === 'Recording stopped') resolve(); }));
  service.stopRecording();
  assert.equal(service.isProcessingAudio, true);
  resolveFirst('First question');
  await first;
  await stopped;
  assert.deepEqual(transcripts, ['First question', 'Final question']);
  assert.equal(calls, 2);
  assert.equal(service.segmentBytes, 0);
});

test('Azure receives renderer PCM through its push stream', async () => {
  const pushed = [];
  const stream = { write: buffer => pushed.push(buffer), close() {} };
  const sdk = { AudioInputStream: { createPushStream: () => stream }, AudioConfig: { fromStreamInput: () => ({ close() {} }) },
    SpeechRecognizer: class { startContinuousRecognitionAsync(success) { success(); } stopContinuousRecognitionAsync(success) { success(); } close() {} } };
  const { service } = speechService(undefined, sdk);
  service.provider = 'azure'; service.speechConfig = {}; service.available = true;
  service.startRecording();
  const pcm = Buffer.from([1, 2, 3, 4]);
  service.handleAudioChunkFromRenderer(pcm);
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0], pcm);
  service.stopRecording();
  assert.equal(service.isRecording, false);
});
