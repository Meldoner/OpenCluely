const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const config = require('../src/core/config');

// Load the class without initializing SDKs, touching logs, or recording audio.
function speech(t, transcribe = async () => 'да', mode = 'vad') {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/speech.service.js'), 'utf8');
  const context = { EventEmitter, Buffer, AbortController, config,
    require: name => {
      if (name === '../core/speech-retry') {
        const retry = require('../src/core/speech-retry');
        return { ...retry, waitForSpeechRetry: (attempt, signal) => retry.waitForSpeechRetry(attempt, signal, 1) };
      }
      if (name.startsWith('../core/')) return require('../src/core/' + name.slice('../core/'.length));
      throw new Error(name);
    },
    process: { env: { SPEECH_PROVIDER: 'cloudflare', WHISPER_CAPTURE_MODE: mode }, platform: 'win32' },
    logger: { info() {}, warn() {}, error() {} },
    cloudflareSpeech: { isConfigured: () => true, transcribe },
    WhisperWorkerService: class { close() {} releaseWhenIdle() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate };
  vm.runInNewContext(source.slice(source.indexOf('class SpeechService extends EventEmitter {'), source.indexOf('module.exports = new SpeechService();')) + '\nthis.Speech = SpeechService;', context);
  const service = new context.Speech();
  const errors = [], transcripts = [], statuses = [];
  service.on('error', error => errors.push(error));
  service.on('transcription', text => transcripts.push(text));
  service.on('status', status => statuses.push(status));
  t.after(() => service.shutdown());
  service.startRecording();
  return { service, errors, transcripts, statuses };
}

function pcm(ms, amplitude = 0) {
  const data = Buffer.alloc(ms * 32);
  for (let i = 0; i < data.length / 2; i++) data.writeInt16LE(Math.round(amplitude * Math.sin(i * 0.19)), i * 2);
  return data;
}

function feed(service, data) {
  for (let offset = 0; offset < data.length && service.isRecording; offset += 8192) {
    service.handleAudioChunkFromRenderer(data.subarray(offset, offset + 8192));
  }
}

function stopped(service) {
  return new Promise(resolve => service.on('status', text => { if (text === 'Recording stopped') resolve(); }));
}

test('quiet 120 ms words inside renderer blocks reach transcription with bounded gain', async t => {
  const uploads = [];
  const { service, transcripts } = speech(t, async wav => { uploads.push(wav); return 'да'; });
  feed(service, Buffer.concat([pcm(300), pcm(120, 160), pcm(1000)]));
  await service.transcriptionTask;
  assert.deepEqual(transcripts, ['да']);
  assert.equal(uploads.length, 1);
  const audio = uploads[0].subarray(44);
  assert.ok(service._chunkRmsEnergy(audio) > 0);
  let peak = 0;
  for (let i = 0; i < audio.length; i += 2) peak = Math.max(peak, Math.abs(audio.readInt16LE(i)));
  assert.ok(peak > 160 && peak <= 160 * 8);
});

test('short words at recording start survive, while silence and a 20 ms click do not', async t => {
  let requests = 0;
  const { service, transcripts } = speech(t, async () => { requests++; return 'OK'; });
  feed(service, pcm(800));
  feed(service, Buffer.concat([pcm(20, 4000), pcm(900)]));
  assert.equal(requests, 0);
  feed(service, Buffer.concat([pcm(100, 4000), pcm(900)]));
  await service.transcriptionTask;
  assert.deepEqual(transcripts, ['OK']);
  assert.equal(requests, 1);
  for (const text of ['okay', 'you', 'bye', 'thank you', 'да', 'I']) assert.equal(service._isHallucinatedTranscript(text), false);
  assert.equal(service._isHallucinatedTranscript('Thank you for watching!'), true);
});

test('near-threshold background cannot raise VAD sensitivity enough to swallow a quiet word', async t => {
  const { service, transcripts } = speech(t);
  feed(service, Buffer.concat([pcm(3000, 60), pcm(120, 120), pcm(1000, 60)]));
  await service.transcriptionTask;
  assert.deepEqual(transcripts, ['да']);
});

test('stopping before the silence hangover still sends a short final word', async t => {
  const { service, transcripts } = speech(t);
  feed(service, pcm(120, 160));
  const finished = stopped(service);
  service.stopRecording();
  await finished;
  assert.deepEqual(transcripts, ['да']);
  assert.equal(service.isProcessingAudio, false);
});

test('utterance cap includes pauses and prevents oversized requests during a monologue', async t => {
  const durations = [];
  const { service } = speech(t, async wav => { durations.push((wav.length - 44) / 32); return 'speech'; });
  service.runtimeSettings.whisperMaxUtteranceMs = 2000;
  const pattern = Buffer.concat([pcm(100, 3000), pcm(500)]);
  feed(service, Buffer.concat([pattern, pattern, pattern, pattern, pattern, pcm(900)]));
  const finished = stopped(service);
  service.stopRecording();
  await finished;
  assert.ok(durations.length >= 2);
  assert.ok(durations.every(ms => ms <= 2020), JSON.stringify(durations));
});

test('slow transcription preserves separate queued utterances and Stop drains all of them in order', async t => {
  let resolveFirst;
  const uploads = [];
  const { service, transcripts } = speech(t, async wav => {
    uploads.push(wav.length - 44);
    if (uploads.length === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return String(uploads.length);
  }, 'manual');
  feed(service, pcm(100, 1000));
  const task = service._flushWhisperSegment();
  feed(service, pcm(200, 1000)); service._flushWhisperSegment();
  feed(service, pcm(300, 1000)); service._flushWhisperSegment();
  feed(service, pcm(400, 1000));
  const finished = stopped(service);
  service.stopRecording();
  assert.equal(service.isProcessingAudio, true);
  resolveFirst('1');
  await task;
  await finished;
  assert.deepEqual(uploads, [3200, 6400, 9600, 12800]);
  assert.deepEqual(transcripts, ['1', '2', '3', '4']);
  assert.equal(service.queuedAudioBytes, 0);
});

test('backlog limit stops capture visibly and drains accepted speech without dropping or merging it', async t => {
  let resolveFirst, calls = 0, stopEvents = 0;
  const { service, statuses, transcripts } = speech(t, async () => {
    calls++;
    if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return String(calls);
  }, 'manual');
  service._getMaxQueuedAudioBytes = () => 6400;
  service.on('recording-stopped', () => stopEvents++);
  feed(service, pcm(100, 1000)); const task = service._flushWhisperSegment();
  feed(service, pcm(100, 1000)); service._flushWhisperSegment();
  feed(service, pcm(100, 1000)); service._flushWhisperSegment();
  assert.equal(service.isRecording, false);
  assert.equal(service.isProcessingAudio, true);
  assert.equal(service.queuedAudioBytes, 6400);
  assert.equal(stopEvents, 1);
  assert.ok(statuses.some(text => /slower than recording/.test(text)));
  const finished = stopped(service);
  resolveFirst('1');
  await task; await finished;
  assert.deepEqual(transcripts, ['1', '2', '3']);
});

test('a stuck provider times out, aborts and unlocks recording; its late result cannot affect a new session', async t => {
  let resolveOld, signal;
  const { service, errors, transcripts } = speech(t, (_wav, _language, _settings, options) => {
    signal = options.signal;
    return new Promise(resolve => { resolveOld = resolve; });
  }, 'manual');
  service._getTranscriptionTimeoutMs = () => 15;
  feed(service, pcm(100, 1000));
  const task = service._flushWhisperSegment();
  service.stopRecording();
  await assert.rejects(task, /timed out/);
  assert.equal(signal.aborted, true);
  assert.equal(service.isRecording, false);
  assert.equal(service.isProcessingAudio, false);
  assert.equal(service.transcriptionQueue.length, 0);
  assert.equal(errors.length, 1);
  service._transcribeWhisperBuffer = async () => 'new';
  service.startRecording();
  resolveOld('stale');
  feed(service, pcm(100, 1000));
  await service._flushWhisperSegment();
  assert.deepEqual(transcripts, ['new']);
  assert.equal(service.isRecording, true);
});

test('shutdown cancels pending transcription and an old Stop cannot clear a restarted session', async t => {
  const { service, transcripts } = speech(t, () => new Promise(() => {}), 'manual');
  feed(service, pcm(100, 1000));
  const task = service._flushWhisperSegment();
  service.stopRecording();
  service.shutdown();
  service.startRecording();
  await assert.rejects(task, /cancelled/);
  assert.equal(service.isRecording, true);
  assert.deepEqual(transcripts, []);
});

test('a forced boundary overlaps PCM and removes only the corresponding transcript prefix', async t => {
  const audio = [], answers = ['The KV cache', 'KV cache saves memory'];
  const { service, transcripts } = speech(t, async wav => { audio.push(wav.subarray(44)); return answers.shift(); });
  service.runtimeSettings.whisperMaxUtteranceMs = 2000;
  feed(service, pcm(2400, 1000));
  const finished = stopped(service);
  service.stopRecording(); await finished;
  assert.equal(audio.length, 2);
  assert.deepEqual(audio[0].subarray(-400 * 32), audio[1].subarray(0, 400 * 32));
  assert.deepEqual(transcripts, ['The KV cache', 'saves memory']);
});

test('transient speech requests retry the same audio and emit one result; permanent errors do not retry', async t => {
  const uploads = [];
  const { service, transcripts } = speech(t, async wav => {
    uploads.push(wav);
    if (uploads.length < 3) throw Object.assign(new Error('temporarily unavailable'), { status: 503 });
    return 'Recovered';
  }, 'manual');
  feed(service, pcm(100, 1000));
  await service._flushWhisperSegment();
  assert.equal(uploads.length, 3);
  assert.deepEqual(uploads[0], uploads[1]); assert.deepEqual(uploads[0], uploads[2]);
  assert.deepEqual(transcripts, ['Recovered']);
  let calls = 0;
  const permanent = speech(t, async () => { calls++; throw Object.assign(new Error('forbidden'), { status: 403 }); }, 'manual');
  feed(permanent.service, pcm(100, 1000));
  await assert.rejects(permanent.service._flushWhisperSegment(), /forbidden/);
  assert.equal(calls, 1);
});
