const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const GeminiTranscriptionRetry = require('../src/services/gemini-transcription-retry.service');
const { createRecoveringTranscription } = require('../src/services/gemini-live.service');

const disconnected = () => Object.assign(new Error('offline'), { code: 'LIVE_CONNECTION_LOST' });
class Session extends EventEmitter {
  constructor(error) { super(); this.error = error; this.audio = []; this.messages = []; }
  async connect() { if (this.error) throw this.error; this.ready = true; return this; }
  sendAudio(buffer) { this.audio.push(buffer); }
  send(message) { this.messages.push(message); }
  async finish() { this.emit('content', { inputTranscription: { text: 'Final phrase' } }); }
  close(reason = disconnected()) { this.closed = true; this.emit('closed', reason); }
}

function stream(t, errors = [], options = {}) {
  const sessions = [];
  const live = new GeminiTranscriptionRetry(() => {
    const session = new Session(errors[sessions.length]);
    sessions.push(session); return session;
  }, { retryDelayMs: 1, replayDelayMs: 0, ...options });
  t.after(() => live.close());
  return { live, sessions };
}

test('Live setup retries temporary failures, but does not retry invalid credentials', async t => {
  const { live, sessions } = stream(t, [Object.assign(new Error('unavailable'), { status: 503 })]);
  await live.connect();
  assert.equal(sessions.length, 2);
  assert.equal(live.ready, true);
  const permanent = stream(t, [Object.assign(new Error('forbidden'), { status: 403 })]);
  await assert.rejects(permanent.live.connect(), /forbidden/);
  assert.equal(permanent.sessions.length, 1);
});

test('a dropped Live connection replays buffered PCM and new audio received during reconnect in order', async t => {
  const { live, sessions } = stream(t);
  const transcripts = [];
  live.on('content', content => { if (content.inputTranscription?.text) transcripts.push(content.inputTranscription.text); });
  await live.connect();
  const first = Buffer.alloc(3200, 1), next = Buffer.alloc(3200, 2);
  live.sendAudio(first);
  const recovered = once(live, 'reconnected');
  sessions[0].close();
  live.sendAudio(next);
  await recovered;
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions[1].audio, [first, next]);
  sessions[1].emit('content', { inputTranscription: { text: 'Recovered phrase' } });
  assert.deepEqual(transcripts, ['Recovered phrase']);
});

test('only the replay boundary removes confirmed text; normal repeated phrases are preserved', async t => {
  const { live, sessions } = stream(t);
  const transcripts = [];
  live.on('content', content => { if (content.inputTranscription?.text) transcripts.push(content.inputTranscription.text); });
  await live.connect();
  live.sendAudio(Buffer.alloc(3200, 1));
  sessions[0].emit('content', { inputTranscription: { text: 'The KV cache' } });
  live.sendAudio(Buffer.alloc(3200, 2));
  const recovered = once(live, 'reconnected');
  sessions[0].close(); await recovered;
  sessions[1].emit('content', { inputTranscription: { text: 'KV cache improves latency.' } });
  sessions[1].emit('content', { inputTranscription: { text: 'KV cache improves latency.' } });
  assert.deepEqual(transcripts, ['The KV cache', 'improves latency.', 'KV cache improves latency.']);
});

test('Stop during recovery waits for replay and final transcript, including manual activity start', async t => {
  const { live, sessions } = stream(t);
  const transcripts = [];
  live.on('content', content => { if (content.inputTranscription?.text) transcripts.push(content.inputTranscription.text); });
  await live.connect();
  live.send({ realtimeInput: { activityStart: {} } });
  live.sendAudio(Buffer.alloc(3200, 1));
  sessions[0].close();
  await live.finish({ hasSpeech: true });
  assert.deepEqual(transcripts, ['Final phrase']);
  assert.deepEqual(sessions[1].messages, [{ realtimeInput: { activityStart: {} } }]);
  assert.equal(sessions[1].audio.length, 1);
});

test('Live retry attempts and pending audio are bounded, and closing cancels backoff', async t => {
  const { live, sessions } = stream(t, [null, disconnected(), disconnected()]);
  await live.connect();
  const failed = once(live, 'closed');
  sessions[0].close(); await failed;
  assert.equal(sessions.length, 3);
  assert.equal(live.closed, true);
  assert.equal(live.pendingBytes, 0);
  const cancelling = stream(t, [], { retryDelayMs: 10000 });
  await cancelling.live.connect();
  cancelling.sessions[0].close();
  const recovery = cancelling.live.recovery;
  cancelling.live.close(new Error('cancelled'));
  await assert.rejects(recovery, /cancelled/);
  assert.equal(cancelling.sessions.length, 1);
  const overloaded = stream(t);
  await overloaded.live.connect();
  overloaded.live.sendAudio(Buffer.alloc(60000 * 32 + 2, 1));
  assert.equal(overloaded.live.closed, true);
});

test('long desktop silence keeps a bounded pre-roll and does not stop Live recording', async t => {
  const { live } = stream(t);
  await live.connect();
  for (let i = 0; i < 90; i++) live.sendAudio(Buffer.alloc(32000));
  assert.equal(live.closed, false);
  assert.equal(live.ready, true);
  assert.ok(live.pendingBytes <= 32000);
});

test('the real Transcribe session passes vocabulary through a retrying connection without network access', async t => {
  class Transport extends EventEmitter {
    start() { queueMicrotask(() => this.emit('open')); }
    send(message) {
      if (message.setup) {
        this.setup = message.setup;
        queueMicrotask(() => this.emit('message', { setupComplete: {} }));
      }
    }
    close() {}
  }
  const transport = new Transport();
  const live = createRecoveringTranscription({ transport, apiKey: 'test-key', customVocabulary: ['KVCache', 'PyTorch'] });
  t.after(() => live.close());
  await live.connect();
  assert.deepEqual(transport.setup.inputAudioTranscription.customVocabulary, ['KVCache', 'PyTorch']);
});
