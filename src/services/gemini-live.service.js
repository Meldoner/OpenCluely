const { EventEmitter } = require('events');
const { DEFAULTS, isConfiguredKey } = require('../core/ai-settings');
const { parse: parseTranscribeLanguages } = require('../core/gemini-transcribe-languages');
const sessions = new Set();
let responseSequence = 0;
const endpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

class LiveSession extends EventEmitter {
  constructor(setup, options = {}) {
    super();
    this.setup = setup;
    this.apiKey = String(options.apiKey || process.env.GEMINI_API_KEY || '').trim();
    this.timeoutMs = options.timeoutMs || 30000;
    this.transport = options.transport || new (require('./gemini-live-transport'))();
    this.closed = false;
    this.ready = false;
    this.on('error', () => {}); // Connection failures also reject the pending operation.
  }

  connect() {
    if (!isConfiguredKey(this.apiKey)) return Promise.reject(new Error('Configure a Gemini API key for Live API'));
    sessions.add(this);
    return new Promise((resolve, reject) => {
      this.rejectConnect = reject;
      this.connectTimer = setTimeout(() => this.fail(new Error('Live API setup timed out')), this.timeoutMs);
      this.transport.on('open', () => { if (!this.closed) this.send({ setup: this.setup }); });
      this.transport.on('message', message => {
        if (this.closed) return;
        if (message.error) { this.fail(new Error(`Live API error (${message.error.code || 'unknown'}); check model access and API key`)); return; }
        if (message.setupComplete) {
          clearTimeout(this.connectTimer);
          this.rejectConnect = null;
          this.ready = true;
          resolve(this);
        }
        if (message.goAway) { this.fail(new Error('Live API session limit reached; restart recording')); return; }
        if (message.serverContent) this.emit('content', message.serverContent);
      });
      this.transport.on('error', () => this.fail(new Error('Live connection failed; check the network, proxy, API key and model access')));
      this.transport.on('close', code => this.fail(new Error(`Live connection closed (${code || 'unknown'})`)));
      try { this.transport.start(`${endpoint}?key=${encodeURIComponent(this.apiKey)}`); }
      catch (error) { this.fail(new Error('Could not start Live transport')); }
    });
  }

  send(message) {
    if (this.closed) throw new Error('Live session is closed');
    try { this.transport.send(message); }
    catch (error) { this.fail(new Error('Could not send to Live API')); }
  }

  sendAudio(buffer) {
    if (!this.ready || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length % 2) throw new Error('Expected 16 kHz mono PCM16 audio in a ready Live session');
    this.send({ realtimeInput: { audio: { data: buffer.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } });
  }

  fail(error) {
    if (this.closed) return;
    this.emit('error', error);
    this.close(error);
  }

  close(error = new Error('Live session cancelled')) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.connectTimer);
    if (this.rejectConnect) this.rejectConnect(error);
    this.rejectConnect = null;
    this.transport.close();
    this.transport.removeAllListeners();
    sessions.delete(this);
    this.emit('closed', error);
    this.removeAllListeners();
  }
}

async function complete(request, onDelta, options = {}) {
  const session = new LiveSession({
    model: `models/${DEFAULTS.geminiLiveModel}`,
    generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: request.generationConfig?.maxOutputTokens || 4096 },
    outputAudioTranscription: {},
    ...(request.systemInstruction ? { systemInstruction: request.systemInstruction } : {})
  }, options);
  let timer;
  try {
    await session.connect();
    return await new Promise((resolve, reject) => {
      let text = '';
      timer = setTimeout(() => reject(new Error('Live response timed out')), options.timeoutMs || 60000);
      session.on('closed', reject);
      session.on('content', content => {
        try {
          if (content.interrupted) throw new Error('Live response interrupted');
          const delta = content.outputTranscription?.text || '';
          if (delta) { text += delta; if (onDelta) onDelta(delta); }
          if (content.turnComplete && content.interactionStatus !== 'IN_PROGRESS') {
            if (!text.trim()) throw new Error('Live API returned no response transcript');
            resolve(text.trim());
          }
        } catch (error) { reject(error); }
      });
      // A new session per request isolates parallel inputs and uses the caller's
      // current history, including after a session reset.
      session.send({ clientContent: { turns: request.contents, turnComplete: true } });
    });
  } finally { clearTimeout(timer); session.close(); }
}

function addAudioFinalization(session, options) {
  session.finish = ({ hasSpeech = true } = {}) => {
    if (!session.ready || session.closed) return Promise.reject(new Error('Live session is not ready for finalization'));
    return new Promise((resolve, reject) => {
      let settleTimer;
      const cleanup = () => {
        clearTimeout(deadline); clearTimeout(settleTimer);
        session.removeListener('content', receive); session.removeListener('closed', failed);
      };
      const done = () => { cleanup(); resolve(); };
      const failed = error => { cleanup(); reject(error); };
      const receive = content => {
        if (options.waitForResponse && (content.inputTranscription || content.outputTranscription)) clearTimeout(settleTimer);
        if ((!options.waitForResponse && content.inputTranscription) || (content.turnComplete && content.interactionStatus !== 'IN_PROGRESS')) {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(done, 300);
        }
      };
      const deadline = setTimeout(() => failed(new Error('Live audio finalization timed out')), options.finishTimeoutMs || (options.waitForResponse ? 60000 : 15000));
      session.on('content', receive); session.on('closed', failed);
      // With silence and no unfinished speech, no final transcript is expected.
      if (!hasSpeech && !session.responseInFlight) settleTimer = setTimeout(done, 1000);
      try { session.send({ realtimeInput: options.manual ? { activityEnd: {} } : { audioStreamEnd: true } }); }
      catch (error) { failed(error); }
    });
  };
  return session;
}

function createTranscription(options = {}) {
  return addAudioFinalization(new LiveSession({
    model: `models/${DEFAULTS.geminiLiveTranscribeModel}`,
    generationConfig: { responseModalities: ['TEXT'] },
    inputAudioTranscription: { languageCodes: parseTranscribeLanguages(options.languageCodes ?? process.env.GEMINI_TRANSCRIBE_LANGUAGES ?? DEFAULTS.geminiTranscribeLanguages) },
    realtimeInputConfig: { automaticActivityDetection: { disabled: !!options.manual } }
  }, options), options);
}

function createAudioConversation(request, options = {}) {
  const history = request.contents || [];
  const session = addAudioFinalization(new LiveSession({
    model: `models/${DEFAULTS.geminiLiveModel}`,
    generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: request.generationConfig?.maxOutputTokens || 4096 },
    inputAudioTranscription: {}, outputAudioTranscription: {},
    realtimeInputConfig: { automaticActivityDetection: { disabled: !!options.manual } },
    ...(request.systemInstruction ? { systemInstruction: request.systemInstruction } : {}),
    ...(history.length ? { historyConfig: { initialHistoryInClientContent: true } } : {})
  }, options), { ...options, waitForResponse: true });
  const connect = session.connect.bind(session);
  session.connect = async () => {
    await connect();
    if (history.length) session.send({ clientContent: { turns: history, turnComplete: true } });
    return session;
  };
  let response = null;
  let timer;
  const failResponse = error => {
    clearTimeout(timer);
    if (response) session.emit('response-error', { ...response, error: error.message });
    response = null;
    session.responseInFlight = false;
  };
  session.on('closed', failResponse);
  session.on('content', content => {
    if (typeof content.interimInputTranscription?.text === 'string') session.emit('interim-transcription', content.interimInputTranscription.text);
    if (typeof content.inputTranscription?.text === 'string' && content.inputTranscription.text.trim()) {
      session.responseInFlight = true;
      session.emit('transcription', content.inputTranscription.text.trim());
    }
    if (content.interrupted) { failResponse(new Error('Live response interrupted')); return; }
    const delta = content.outputTranscription?.text;
    if (typeof delta === 'string' && delta) {
      if (!response) {
        response = { messageId: `live-audio-${Date.now()}-${++responseSequence}`, response: '', metadata: request.metadata || {}, startedAt: Date.now() };
        session.responseInFlight = true;
        session.emit('response-start', { ...response });
        timer = setTimeout(() => session.fail(new Error('Live audio response timed out')), options.responseTimeoutMs || 60000);
      }
      response.response += delta;
      session.emit('response-chunk', { messageId: response.messageId, delta });
    }
    if (response && content.turnComplete && content.interactionStatus !== 'IN_PROGRESS') {
      clearTimeout(timer);
      session.emit('response-complete', { ...response, response: response.response.trim() });
      response = null;
      session.responseInFlight = false;
    }
    if (content.turnComplete && content.interactionStatus !== 'IN_PROGRESS') session.responseInFlight = false;
  });
  return session;
}

function shutdown() { for (const session of [...sessions]) session.close(); }
module.exports = { LiveSession, complete, createTranscription, createAudioConversation, shutdown };
