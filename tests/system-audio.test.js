const test = require('node:test');
const assert = require('node:assert/strict');
const SystemAudioCapture = require('../src/ui/system-audio-capture');
const { configureSystemAudioSession } = require('../src/core/system-audio-session');

function fakeStream(audio = true) {
  const tracks = [ { stopped: false, stop() { this.stopped = true; }, addEventListener() {} } ];
  if (audio) tracks.push({ stopped: false, stop() { this.stopped = true; }, addEventListener() {} });
  return { getTracks: () => tracks, getAudioTracks: () => audio ? [tracks[1]] : [] };
}

function fakeAudioContext() {
  const state = {};
  class AudioContext {
    constructor() { this.sampleRate = 16000; this.destination = {}; state.context = this; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { return state.processor = { connect() {}, disconnect() {} }; }
    createGain() { return state.mute = { gain: {}, connect() {}, disconnect() {} }; }
    async resume() {}
    async close() { this.closed = true; }
  }
  return { state, AudioContext };
}

test('Windows records desktop output, converts PCM and mutes playback without touching microphone', async () => {
  const stream = fakeStream();
  const { state, AudioContext } = fakeAudioContext();
  let displayRequests = 0;
  let pcm;
  const capture = new SystemAudioCapture({ platform: 'win32', AudioContext, onChunk: buffer => pcm = new Int16Array(buffer), onEnded() {}, mediaDevices: {
    async getDisplayMedia(options) { displayRequests++; assert.equal(options.audio, true); return stream; },
    getUserMedia() { assert.fail('Microphone must never be requested'); }
  } });
  await capture.start();
  state.processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([-1, 0, 1]) } });
  assert.deepEqual([...pcm], [-32768, 0, 32767]);
  assert.equal(state.mute.gain.value, 0);
  assert.equal(displayRequests, 1);
  capture.stop();
  assert.ok(stream.getTracks().every(track => track.stopped));
  assert.equal(state.context.closed, true);
});

test('missing audio and denied sharing fail without a microphone fallback', async () => {
  const stream = fakeStream(false);
  const capture = new SystemAudioCapture({ platform: 'win32', ...fakeAudioContext(), onChunk() {}, onEnded() {}, mediaDevices: {
    async getDisplayMedia() { return stream; }, getUserMedia() { assert.fail('No microphone fallback'); }
  } });
  await assert.rejects(capture.start(), /No system audio track/);
  assert.ok(stream.getTracks().every(track => track.stopped));
  capture.mediaDevices.getDisplayMedia = async () => { throw new Error('denied'); };
  await assert.rejects(capture.start(), /denied/);
});

test('stopping while acquisition is pending releases the eventual stream', async () => {
  let resolveStream;
  const stream = fakeStream();
  const capture = new SystemAudioCapture({ platform: 'win32', ...fakeAudioContext(), onChunk() {}, onEnded() {}, mediaDevices: {
    getDisplayMedia: () => new Promise(resolve => resolveStream = resolve)
  } });
  const started = capture.start();
  capture.stop();
  resolveStream(stream);
  await started;
  assert.ok(stream.getTracks().every(track => track.stopped));
  assert.equal(capture.context, null);
});

test('macOS requires an explicit loopback device and never requests default input', async () => {
  const stream = fakeStream();
  const capture = new SystemAudioCapture({ platform: 'mac', ...fakeAudioContext(), onChunk() {}, onEnded() {}, mediaDevices: {
    async enumerateDevices() { return [{ kind: 'audioinput', label: 'Loopback', deviceId: 'virtual-output' }]; },
    async getUserMedia(options) { assert.equal(options.audio.deviceId.exact, 'virtual-output'); return stream; }
  } });
  await assert.rejects(capture.start(), /loopback device/);
  capture.deviceLabel = 'Loopback';
  await capture.start();
  capture.stop();
});

test('Electron loopback is granted only to the main window frame requesting audio', async () => {
  let handler;
  const frame = {};
  const source = { id: 'screen:1', name: 'Screen' };
  configureSystemAudioSession({ setDisplayMediaRequestHandler(fn) { handler = fn; } },
    { getSources: async () => [source] }, () => ({ isDestroyed: () => false, webContents: { mainFrame: frame } }), 'win32');
  let granted;
  await handler({ frame, audioRequested: true }, result => granted = result);
  assert.equal(granted.audio, 'loopback');
  assert.equal(granted.video, source);
  await handler({ frame: {}, audioRequested: true }, result => granted = result);
  assert.deepEqual(granted, {});
  await handler({ frame, audioRequested: false }, result => granted = result);
  assert.deepEqual(granted, {});
});
