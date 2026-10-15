const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const FirstRunManager = require('../src/core/first-run');
const config = require('../src/core/config');
const { DEFAULTS } = require('../src/core/ai-settings');
const { parse: parseTranscribeLanguages } = require('../src/core/gemini-transcribe-languages');
const dialogueLanguages = require('../src/core/dialogue-languages');
const { parseVocabulary, vocabularyEnvKey, getSkillVocabulary, legacyVocabularyUpdates } = require('../src/core/transcription-vocabulary');
const { validateEndpoint } = require('../src/services/ai-http');
const { configureNetworkSession } = require('../src/core/network-session');
const catalogue = require('../src/core/skills');
const { promptLoader } = require('../prompt-loader');
const silentLogger = { debug() {}, info() {}, warn() {}, error() {}, logPerformance() {} };

test('OpenAI routing preserves skill expertise for both voice and typed questions', async () => {
  const requests = [];
  const context = { module: { exports: {} }, process: { env: { DIALOGUE_LANGUAGES: 'ru-RU' } }, require: name => {
    if (name === '@google/genai') return { GoogleGenAI: class {} };
    if (name.includes('logger')) return { createServiceLogger: () => silentLogger };
    if (name === '../core/config') return config;
    if (name === '../core/dialogue-languages') return dialogueLanguages;
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
  assert.match(requests[0].systemInstruction.parts[0].text, /machine learning engineer/);
  assert.match(requests[0].systemInstruction.parts[0].text, /Go/);
  assert.match(requests[1].systemInstruction.parts[0].text, /product, data, business or systems analyst/);
  for (const request of requests) {
    assert.match(request.systemInstruction.parts.at(-1).text, /Write answer explanations in Russian/);
    const instructions = request.systemInstruction.parts[0].text;
    assert.match(instructions, /Live interview response style/);
    assert.match(instructions, /2-5 short sentences/);
    assert.doesNotMatch(instructions, /Do not truncate or shorten|Keep responses detailed|Respond ONLY in Go/);
  }
  const imageRequest = llm.formatImageInstruction('backend', 'go');
  assert.match(imageRequest, /code only for a coding task/);
  assert.equal(llm.formatUserMessage(' Что такое транзакция? ', 'backend'), 'Что такое транзакция?');
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
  const speechService = Object.assign(new EventEmitter(), { isRecording: false, isProcessingAudio: false, initializeClient() { this.initializations = (this.initializations || 0) + 1; }, isAvailable: () => true });
  const llmService = { initializeClient() { this.initializations = (this.initializations || 0) + 1; } };
  const context = { process: { env }, skills: catalogue, config, DEFAULTS, parseTranscribeLanguages, parseVocabulary, vocabularyEnvKey, getSkillVocabulary, legacyVocabularyUpdates, getDialogueLanguages: dialogueLanguages.getDialogueLanguages, validateEndpoint, configureNetworkSession, logger: silentLogger,
    speechService, llmService, sessionManager: { setActiveSkill(skill) { this.skill = skill; } },
    windowManager: { broadcastToAllWindows: (channel, data) => broadcasts.push({ channel, data }) },
    require, Buffer, path, fs, BrowserWindow: { getAllWindows: () => [] }, formatEnvValue: value => String(value), ENV_PATH: 'unused' };
  vm.runInNewContext(source.slice(start, end) + '\nthis.Controller = ApplicationController;', context);
  const controller = Object.create(context.Controller.prototype);
  controller.activeSkill = env.ACTIVE_SKILL || 'dsa'; controller.codingLanguage = 'cpp';
  controller.persistEnvUpdates = updates => { Object.assign(env, updates); return Object.keys(updates); };
  return { controller, context, broadcasts };
}

function voiceController() {
  const state = mainController();
  const { controller, context } = state;
  const timers = new Map(), requests = [], events = [], history = [];
  let timerId = 0;
  context.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
  context.clearTimeout = id => timers.delete(id);
  context.speechService.isManualCaptureMode = () => false;
  context.sessionManager.addUserInput = text => history.push({ role: 'user', content: text });
  context.sessionManager.addModelResponse = (text, metadata) => history.push({ role: 'model', content: text, metadata });
  context.sessionManager.getOptimizedHistory = () => ({ recent: [...history] });
  context.sessionManager.clear = () => { history.length = 0; };
  context.llmService.provider = 'gemini-live';
  context.llmService.processTranscriptionWithIntelligentResponseStream = (text, skill, recent, language, onDelta) =>
    new Promise((resolve, reject) => requests.push({ text, skill, recent, language, onDelta,
      resolve: response => resolve({ response, metadata: { skill } }), reject }));
  controller._utteranceBuffer = '';
  controller._utteranceCoalesceMs = 800;
  controller.shouldShowVoiceOverlay = () => false;
  controller.sendToVoiceResponseWindows = (channel, data) => events.push({ channel, data });
  controller.sendTranscriptionLLMResponseToVoiceTargets = result => events.push({ channel: 'final', data: result });
  const pause = () => {
    const callbacks = [...timers.values()]; timers.clear();
    callbacks.forEach(callback => callback());
  };
  return { ...state, timers, requests, events, history, pause };
}

test('a second spoken question starts before the first answer completes, with independent response IDs', async () => {
  const { controller, requests, events, history, pause } = voiceController();
  controller.handleTranscriptionFragment('What is VPC?'); pause();
  controller.handleTranscriptionFragment('What is SRE?'); pause();
  assert.equal(requests.length, 2, 'The second question must not wait for the first model response');
  assert.deepEqual(requests.map(request => request.text), ['What is VPC?', 'What is SRE?']);
  const starts = events.filter(event => event.channel === 'transcription-llm-response-start');
  assert.equal(starts.length, 2);
  assert.notEqual(starts[0].data.messageId, starts[1].data.messageId);
  requests[1].onDelta('SRE'); requests[1].resolve('SRE answer');
  await new Promise(setImmediate);
  assert.equal(events.find(event => event.channel === 'final').data.metadata.messageId, starts[1].data.messageId);
  controller.activeSkill = 'analyst';
  requests[0].onDelta('VPC'); requests[0].resolve('VPC answer');
  await new Promise(setImmediate);
  assert.deepEqual(events.filter(event => event.channel === 'transcription-llm-response-chunk').map(event => event.data.messageId), [starts[1].data.messageId, starts[0].data.messageId]);
  assert.deepEqual(history.filter(event => event.role === 'model').map(event => event.content), ['SRE answer', 'VPC answer']);
  assert.ok(history.filter(event => event.role === 'model').every(event => event.metadata.skill === 'dsa'));
});

test('finishing one voice answer does not dispatch an unfinished next question before its coalescing pause', async () => {
  const { controller, requests, timers, pause } = voiceController();
  controller.handleTranscriptionFragment('First question'); pause();
  controller.handleTranscriptionFragment('Explain');
  requests[0].resolve('First answer');
  await new Promise(setImmediate);
  assert.equal(requests.length, 1);
  controller.handleTranscriptionFragment('SRE');
  assert.equal(timers.size, 1);
  pause();
  assert.equal(requests[1].text, 'Explain SRE');
  requests[1].resolve('Second answer');
  await new Promise(setImmediate);
});

test('a failed voice request keeps its error ID and does not hide another answer still streaming', async () => {
  const { controller, context, requests, events, broadcasts, pause } = voiceController();
  let hidden = 0;
  controller.shouldShowVoiceOverlay = () => true;
  context.windowManager.showLLMLoading = () => {};
  context.windowManager.showLLMResponse = () => {};
  context.windowManager.hideLLMResponse = () => { hidden++; };
  controller.handleTranscriptionFragment('First question'); pause();
  controller.handleTranscriptionFragment('Second question'); pause();
  const starts = events.filter(event => event.channel === 'transcription-llm-response-start');
  requests[0].reject(new Error('Live API error (409)'));
  await new Promise(setImmediate);
  assert.equal(broadcasts.find(event => event.channel === 'llm-error').data.messageId, starts[0].data.messageId);
  assert.equal(hidden, 0);
  requests[1].onDelta('Second partial'); requests[1].resolve('Second answer');
  await new Promise(setImmediate);
  assert.equal(events.find(event => event.channel === 'final').data.metadata.messageId, starts[1].data.messageId);
  assert.equal(controller._voiceResponseIds.size, 0);
});

test('clearing voice questions removes buffered input and ignores late chunks, answers and errors', async () => {
  const { controller, requests, events, history, timers, pause, broadcasts } = voiceController();
  controller.handleTranscriptionFragment('First question'); pause();
  controller.handleTranscriptionFragment('Second question'); pause();
  controller.handleTranscriptionFragment('Buffered old question');
  controller.clearSessionMemory();
  assert.equal(timers.size, 0);
  assert.equal(controller._utteranceBuffer, '');
  const before = events.length;
  requests[0].onDelta('Old partial'); requests[0].resolve('Old answer');
  requests[1].reject(new Error('Old failure'));
  await new Promise(setImmediate);
  assert.equal(events.length, before);
  assert.deepEqual(history, []);
  assert.equal(broadcasts.some(event => event.channel === 'llm-error'), false);
  controller.handleTranscriptionFragment('New question'); pause();
  requests[2].resolve('New answer');
  await new Promise(setImmediate);
  assert.deepEqual(history.map(event => event.content), ['New question', 'New answer']);
});

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

test('global dialogue languages persist, override legacy hints and cannot change during capture', () => {
  const { controller, context } = mainController({ GEMINI_TRANSCRIBE_LANGUAGES: 'en-US' });
  assert.deepEqual([...controller.getSettings().dialogueLanguages], ['en-US']);
  assert.equal(controller.saveSettings({ dialogueLanguages: ['ru-ru', 'en-US'], geminiModel: 'custom-gemini' }).success, true);
  assert.equal(context.process.env.DIALOGUE_LANGUAGES, 'ru-RU,en-US');
  assert.equal(context.process.env.GEMINI_MODEL, 'custom-gemini');
  assert.equal(controller.getSettings().geminiModel, 'custom-gemini');
  assert.deepEqual([...controller.getSettings().dialogueLanguages], ['ru-RU', 'en-US']);
  assert.equal(context.speechService.initializations, 1);
  assert.equal(controller.saveSettings({ dialogueLanguages: ['invalid'] }).success, false);
  context.speechService.isRecording = true;
  assert.equal(controller.saveSettings({ dialogueLanguages: [] }).success, false);
  assert.equal(context.process.env.DIALOGUE_LANGUAGES, 'ru-RU,en-US');
  context.speechService.isRecording = false;
  assert.equal(controller.saveSettings({ dialogueLanguages: [] }).success, true);
  assert.deepEqual([...controller.getSettings().dialogueLanguages], []);
  // An explicit empty global selection must also override unmigrated hints.
  const legacy = mainController({ GEMINI_TRANSCRIBE_LANGUAGES: 'ru-RU' });
  assert.equal(legacy.controller.saveSettings({ dialogueLanguages: [] }).success, true);
  assert.equal(legacy.context.speechService.initializations, 1);
});

test('Live selections persist and a shared Gemini key cannot change during Live capture', () => {
  const { controller, context } = mainController();
  const result = controller.saveSettings({ llmProvider: 'gemini-live', speechProvider: 'gemini-live', geminiKey: 'test-key' });
  assert.equal(result.success, true);
  assert.equal(context.process.env.LLM_PROVIDER, 'gemini-live');
  assert.equal(context.process.env.SPEECH_PROVIDER, 'gemini-live');
  assert.equal(context.process.env.GEMINI_API_KEY, 'test-key');
  context.speechService.provider = 'gemini-live';
  assert.equal(controller.getSettings().llmProvider, 'gemini-live');
  assert.equal(controller.getSettings().speechProvider, 'gemini-live');
  context.speechService.isRecording = true;
  assert.equal(controller.saveSettings({ geminiKey: 'replacement' }).success, false);
  assert.equal(context.process.env.GEMINI_API_KEY, 'test-key');
  context.speechService.isRecording = false;
  assert.equal(controller.saveSettings({ geminiKey: 'replacement' }).success, true);
  assert.equal(context.speechService.initializations, 2);
});

test('native Gemini audio requires matching answers and external transcribers stay independently selectable', () => {
  const { controller, context } = mainController({ LLM_PROVIDER: 'openai', SPEECH_PROVIDER: 'disabled' });
  assert.equal(controller.saveSettings({ speechProvider: 'gemini-live-audio' }).success, false);
  assert.equal(context.process.env.SPEECH_PROVIDER, 'disabled');
  assert.equal(controller.saveSettings({ llmProvider: 'gemini-live', speechProvider: 'gemini-live-audio' }).success, true);
  assert.equal(controller.getSettings().speechProvider, 'gemini-live-audio');
  assert.equal(controller.saveSettings({ llmProvider: 'openai' }).success, false);
  assert.equal(context.process.env.LLM_PROVIDER, 'gemini-live');
  for (const provider of ['gemini-live', 'whisper', 'azure', 'cloudflare', 'disabled']) {
    assert.equal(controller.saveSettings({ speechProvider: provider }).success, true);
    assert.equal(controller.getSettings().speechProvider, provider);
    assert.equal(controller.getSettings().llmProvider, 'gemini-live');
  }
});

test('a Cloudflare transcript is sent as text to Gemini 3.8 answers through the regular voice path', async () => {
  const { controller, context } = mainController({ LLM_PROVIDER: 'gemini-live', SPEECH_PROVIDER: 'cloudflare' });
  const { service } = speechService(async () => 'Explain indexes');
  const requests = []; const events = [];
  context.speechService = service;
  context.llmService.buildLiveAudioRequest = () => assert.fail('An external transcriber must not request native audio');
  context.llmService.processTranscriptionWithIntelligentResponseStream = async (text, skill, history, language, onDelta) => {
    requests.push({ text, skill }); onDelta('Answer');
    return { response: 'Answer', metadata: {} };
  };
  context.sessionManager.addUserInput = () => {};
  context.sessionManager.addModelResponse = () => {};
  context.sessionManager.getOptimizedHistory = () => ({ recent: [] });
  context.windowManager.handleRecordingStarted = () => {};
  context.windowManager.handleRecordingStopped = () => {};
  controller.sendToVoiceResponseWindows = (channel, data) => events.push({ channel, data });
  controller.shouldShowVoiceOverlay = () => false;
  controller._utteranceBuffer = '';
  controller.setupServiceEventHandlers();
  const done = new Promise(resolve => controller.sendTranscriptionLLMResponseToVoiceTargets = result => { events.push({ channel: 'final', data: result }); resolve(); });
  service.startRecording();
  service.handleAudioChunkFromRenderer(Buffer.alloc(3200, 1));
  service.stopRecording();
  await done;
  assert.deepEqual(requests, [{ text: 'Explain indexes', skill: 'dsa' }]);
  assert.equal(events.find(event => event.channel === 'final').data.response, 'Answer');
  service.shutdown();
});

test('Live voice events display one response without requesting a second answer, and clearing rejects late events', () => {
  const { controller, context } = mainController({ LLM_PROVIDER: 'gemini-live', SPEECH_PROVIDER: 'disabled' });
  const events = []; const history = [];
  context.sessionManager.addUserInput = text => history.push(['user', text]);
  context.sessionManager.addModelResponse = text => history.push(['model', text]);
  context.sessionManager.clear = () => { history.length = 0; };
  controller.sendToVoiceResponseWindows = (channel, data) => events.push({ channel, data });
  controller.shouldShowVoiceOverlay = () => false;
  context.llmService.buildLiveAudioRequest = () => ({ contents: [], metadata: { skill: 'dsa' } });
  context.llmService.processTranscriptionWithIntelligentResponseStream = () => assert.fail('Audio answers must not resubmit transcripts');
  controller.setupServiceEventHandlers();
  context.speechService.emit('live-transcription', 'Question');
  const data = { messageId: 'live-1', metadata: { skill: 'dsa' }, startedAt: Date.now() };
  context.speechService.emit('live-response-start', data);
  context.speechService.emit('live-response-chunk', { messageId: data.messageId, delta: 'Answer' });
  context.speechService.emit('live-response-complete', { ...data, response: 'Answer' });
  assert.deepEqual(history, [['user', 'Question'], ['model', 'Answer']]);
  assert.deepEqual(events.map(event => event.channel), ['transcription-received', 'transcription-llm-response-start', 'transcription-llm-response-chunk', 'transcription-llm-response']);
  assert.equal(new Set(events.slice(1).map(event => event.data.messageId)).size, 1);
  context.speechService.emit('live-response-start', { ...data, messageId: 'old' });
  let cancelled = false;
  context.speechService.cancelLiveRecording = () => { cancelled = true; };
  controller.clearSessionMemory();
  const before = events.length;
  context.speechService.emit('live-response-complete', { ...data, messageId: 'old', response: 'Stale' });
  assert.equal(cancelled, true);
  assert.equal(events.length, before);
  assert.deepEqual(history, []);
});

test('switching to or from Live answers reinitializes audio and requires active capture to stop first', () => {
  const { controller, context } = mainController({ LLM_PROVIDER: 'openai', SPEECH_PROVIDER: 'disabled' });
  assert.equal(controller.saveSettings({ llmProvider: 'gemini-live' }).success, true);
  assert.equal(context.speechService.initializations, 1);
  assert.equal(context.process.env.SPEECH_PROVIDER, 'disabled');
  context.speechService.isRecording = true;
  assert.equal(controller.saveSettings({ llmProvider: 'openai' }).success, false);
  assert.equal(context.process.env.LLM_PROVIDER, 'gemini-live');
  context.speechService.isRecording = false;
  assert.equal(controller.saveSettings({ llmProvider: 'openai' }).success, true);
  assert.equal(context.speechService.initializations, 2);
});

test('Transcribe Live language lists persist, normalize, reset to auto and reject changes during capture', () => {
  const { controller, context } = mainController({ SPEECH_PROVIDER: 'gemini-live' });
  assert.deepEqual(Array.from(controller.getSettings().geminiTranscribeLanguages), []);
  assert.equal(controller.saveSettings({ geminiTranscribeLanguages: ['ru-ru', 'en-US', 'ru-RU'] }).success, true);
  assert.equal(context.process.env.GEMINI_TRANSCRIBE_LANGUAGES, 'ru-RU,en-US');
  assert.deepEqual(Array.from(controller.getSettings().geminiTranscribeLanguages), ['ru-RU', 'en-US']);
  assert.equal(context.speechService.initializations, 1);
  assert.equal(context.llmService.initializations, undefined);
  for (const value of [['ru-RU', 'unsupported'], { language: 'ru-RU' }, ['en-US', 1], 'ru-RU\nLLM_PROVIDER=openai']) {
    assert.equal(controller.saveSettings({ geminiTranscribeLanguages: value }).success, false);
    assert.equal(context.process.env.GEMINI_TRANSCRIBE_LANGUAGES, 'ru-RU,en-US');
  }
  context.speechService.isRecording = true;
  assert.equal(controller.saveSettings({ geminiTranscribeLanguages: [] }).success, false);
  context.speechService.isRecording = false;
  context.speechService.isProcessingAudio = true;
  assert.equal(controller.saveSettings({ geminiTranscribeLanguages: [] }).success, false);
  context.speechService.isProcessingAudio = false;
  assert.equal(controller.saveSettings({ geminiTranscribeLanguages: [] }).success, true);
  assert.equal(context.process.env.GEMINI_TRANSCRIBE_LANGUAGES, '');
  assert.deepEqual(Array.from(controller.getSettings().geminiTranscribeLanguages), []);
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

test('short spoken words and single-letter terms reach the answer model while punctuation is ignored', async () => {
  const { controller, context } = mainController();
  const questions = [];
  context.sessionManager.addModelResponse = () => {};
  context.llmService.processTranscriptionWithIntelligentResponseStream = async text => {
    questions.push(text);
    return { response: 'Answer', metadata: {} };
  };
  controller.shouldShowVoiceOverlay = () => false;
  controller.sendToVoiceResponseWindows = () => {};
  controller.sendTranscriptionLLMResponseToVoiceTargets = () => {};
  for (const text of ['I', 'R', 'да', 'OK', '是', '...', ' ']) {
    await controller.processTranscriptionWithLLM(text, { recent: [] });
  }
  assert.deepEqual(questions, ['I', 'R', 'да', 'OK', '是']);
});

test('Transcribe vocabulary validates, persists and requires capture to stop before changing hints', () => {
  const { controller, context } = mainController({ SPEECH_PROVIDER: 'gemini-live' });
  assert.ok(controller.getSettings().geminiTranscribeVocabulary.includes('BFS'));
  assert.equal(controller.saveSettings({ geminiTranscribeVocabulary: 'KVCache, PyTorch,KVCache' }).success, true);
  assert.equal(context.process.env.GEMINI_TRANSCRIBE_VOCABULARY_DSA, 'KVCache,PyTorch');
  assert.deepEqual(controller.getSettings().geminiTranscribeVocabulary, ['KVCache', 'PyTorch']);
  assert.equal(context.speechService.initializations, 1);
  assert.equal(context.llmService.initializations, undefined);
  context.speechService.isRecording = true;
  assert.equal(controller.saveSettings({ geminiTranscribeVocabulary: [] }).success, false);
  context.speechService.isRecording = false;
  assert.equal(controller.saveSettings({ geminiTranscribeVocabulary: [] }).success, true);
  assert.deepEqual(controller.getSettings().geminiTranscribeVocabulary, []);
  for (const value of [['bad\nterm'], Array(101).fill('term'), ['x'.repeat(101)]]) {
    assert.equal(controller.saveSettings({ geminiTranscribeVocabulary: value }).success, false);
  }
});

test('skill vocabulary edits keep their original scope while switching profiles and survive restart', () => {
  const { controller, context } = mainController({ SPEECH_PROVIDER: 'gemini-live' });
  assert.equal(controller.saveSettings({ activeSkill: 'devops', geminiTranscribeVocabulary: 'CustomDSA', geminiTranscribeVocabularySkill: 'dsa' }).success, true);
  assert.equal(context.process.env.GEMINI_TRANSCRIBE_VOCABULARY_DSA, 'CustomDSA');
  assert.ok(controller.getSettings().geminiTranscribeVocabulary.includes('Kubernetes'));
  assert.equal(controller.getSettings().geminiTranscribeVocabulary.includes('CustomDSA'), false);
  assert.equal(controller.saveSettings({ geminiTranscribeVocabulary: '' }).success, true);
  assert.deepEqual(controller.getSettings().geminiTranscribeVocabulary, []);
  assert.equal(controller.saveSettings({ activeSkill: 'dsa' }).success, true);
  assert.deepEqual(controller.getSettings().geminiTranscribeVocabulary, ['CustomDSA']);
  const restarted = mainController({ ...context.process.env });
  assert.deepEqual(restarted.controller.getSettings().geminiTranscribeVocabulary, ['CustomDSA']);
  assert.equal(restarted.controller.saveSettings({ activeSkill: 'devops' }).success, true);
  assert.deepEqual(restarted.controller.getSettings().geminiTranscribeVocabulary, []);
  assert.equal(controller.saveSettings({ geminiTranscribeVocabulary: 'bad', geminiTranscribeVocabularySkill: 'missing' }).success, false);
});

test('legacy custom vocabulary stays on its original skill after switching', () => {
  const { controller, context } = mainController({ ACTIVE_SKILL: 'ai-engineer', GEMINI_TRANSCRIBE_VOCABULARY: 'MyModel,MyLibrary' });
  assert.deepEqual(controller.getSettings().geminiTranscribeVocabulary, ['MyModel', 'MyLibrary']);
  assert.equal(controller.saveSettings({ activeSkill: 'analyst' }).success, true);
  assert.equal(context.process.env.GEMINI_TRANSCRIBE_VOCABULARY_AI_ENGINEER, 'MyModel,MyLibrary');
  assert.ok(controller.getSettings().geminiTranscribeVocabulary.includes('ARPU'));
  assert.equal(controller.saveSettings({ activeSkill: 'ai-engineer' }).success, true);
  assert.deepEqual(controller.getSettings().geminiTranscribeVocabulary, ['MyModel', 'MyLibrary']);
});

test('disabling a built-in glossary is blocked during capture even without an existing override', () => {
  const { controller, context } = mainController({ SPEECH_PROVIDER: 'gemini-live' });
  context.speechService.isRecording = true;
  assert.equal(controller.saveSettings({ geminiTranscribeVocabulary: '' }).success, false);
  assert.equal(context.process.env.GEMINI_TRANSCRIBE_VOCABULARY_DSA, undefined);
});

test('main overlay resize accepts only its own sender and keeps actions within a monitor with negative coordinates', () => {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = source.indexOf('    ipcMain.handle("resize-window"');
  const end = source.indexOf('    ipcMain.handle("move-window"', start);
  let resize;
  const sizes = [], positions = [];
  const window = { webContents: {}, getBounds: () => ({ x: -50, y: 0, width: 520, height: 35 }),
    setContentSize: (width, height) => sizes.push([width, height]), setPosition: (x, y) => positions.push([x, y]) };
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (_channel, handler) => { resize = handler; } }, logger: silentLogger,
    windowManager: { getWindow: () => window },
    screen: { getDisplayMatching: () => ({ workArea: { x: -1280, y: -100, width: 1280, height: 1024 } }) }
  });
  resize({ sender: {} }, { width: 900, height: 400 });
  resize({ sender: window.webContents }, { width: NaN, height: 400 });
  assert.equal(sizes.length, 0);
  resize({ sender: window.webContents }, { width: 900, height: 400 });
  assert.deepEqual(sizes, [[900, 400]]);
  assert.deepEqual(positions, [[-900, 0]]);
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
  fs.writeFileSync(envPath, 'LLM_PROVIDER=gemini-live\nGEMINI_API_KEY=test-key\n');
  assert.equal(manager.needsOnboarding(), false);
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
  const context = { EventEmitter, WhisperWorkerService: Worker, logger: silentLogger, config, sdk, Buffer, require: name => {
    if (name.startsWith('../core/')) return require('../src/core/' + name.slice('../core/'.length));
    return require(name);
  },
    fs, os, path, spawnSync() { assert.fail('Cloudflare must not probe a local executable'); },
    process: { env: { SPEECH_PROVIDER: 'cloudflare', WHISPER_CAPTURE_MODE: 'manual' }, platform: 'win32' },
    cloudflareSpeech: { isConfigured: () => true, transcribe }, startNativeCapture() { assert.fail('Windows must use renderer system audio'); },
    AbortController, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate };
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
