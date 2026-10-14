const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

function localSpeech(device = 'cuda', worker = null) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/speech.service.js'), 'utf8');
  const calls = [];
  const context = {
    EventEmitter, process: { env: { WHISPER_DEVICE: device }, platform: 'win32' },
    path, os, Buffer,
    fs: { mkdtempSync: () => 'test-output', existsSync: () => true, readFileSync: () => 'Привет' },
    config: { get: () => null }, logger: { info() {}, warn() {} },
    spawn(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      setImmediate(() => child.emit('close', 0));
      return child;
    }
  };
  vm.runInNewContext(source.slice(source.indexOf('class SpeechService extends EventEmitter {'), source.indexOf('module.exports = new SpeechService();')) + '\nthis.Speech = SpeechService;', context);
  const service = Object.create(context.Speech.prototype);
  service.runtimeSettings = {};
  service.provider = 'whisper';
  service.whisperCommand = { command: 'C:\\custom-venv\\Scripts\\whisper.exe', baseArgs: [] };
  service.whisperWorker = worker || { isConfigured: () => false };
  service._getWhisperModel = () => 'small';
  service._getWhisperLanguage = () => 'ru';
  service._getWhisperModelDir = () => 'test-models';
  service._removeTempDir = () => {};
  return { service, context, calls };
}

test('CLI fallback honors explicit CUDA and CPU selection and uses matching precision', async () => {
  for (const device of ['cuda', 'cpu', 'auto']) {
    const { service, calls } = localSpeech(device);
    assert.equal(await service._transcribeWhisperFile('test.wav'), 'Привет');
    const { args, options } = calls[0];
    const option = name => args[args.indexOf(name) + 1];
    if (device === 'auto') assert.ok(!args.includes('--device'));
    else assert.equal(option('--device'), device);
    assert.equal(option('--fp16'), device === 'cpu' ? 'False' : 'True');
    assert.equal(option('--language'), 'ru');
    assert.equal(option('--condition_on_previous_text'), 'False');
    assert.equal(options.windowsHide, true);
  }
});

test('known CUDA failures are surfaced without retrying silently on CPU', async () => {
  for (const code of ['CUDA_UNAVAILABLE', 'CUDA_COMPUTE_FAILED']) {
    const error = Object.assign(new Error('GPU unavailable'), { code });
    const { service, calls } = localSpeech('cuda', { isConfigured: () => true, transcribe: async () => { throw error; } });
    await assert.rejects(service._transcribeWhisperFile('test.wav'), failure => failure.code === code);
    assert.equal(calls.length, 0);
  }
  const { service, calls } = localSpeech('cuda', { isConfigured: () => true, transcribe: async () => { throw new Error('Worker protocol failure'); } });
  await service._transcribeWhisperFile('test.wav');
  assert.equal(calls[0].args[calls[0].args.indexOf('--device') + 1], 'cuda');
});

test('local connection test reports real compute diagnostics instead of CLI help success', async () => {
  let released = 0;
  const { service } = localSpeech('cuda', { isConfigured: () => true,
    diagnose: async ({ device }) => {
      assert.equal(device, 'cuda');
      throw Object.assign(new Error('CPU-only PyTorch build'), { code: 'CUDA_UNAVAILABLE' });
    }, releaseWhenIdle: () => released++ });
  const failure = await service.testConnection();
  assert.equal(failure.success, false);
  assert.equal(failure.code, 'CUDA_UNAVAILABLE');
  assert.equal(released, 1);
  service.whisperWorker.diagnose = async () => ({ device: 'cuda', gpu: 'Test GPU', torch: 'test', gpu_verified: true });
  const success = await service.testConnection();
  assert.equal(success.success, true);
  assert.equal(success.gpu_verified, true);
  service.whisperWorker.diagnose = async () => ({ device: 'cpu', torch: 'test+cpu', gpu_verified: false });
  const cpu = await service.testConnection();
  assert.equal(cpu.gpu_verified, false);
  assert.match(cpu.message, /uses CPU/);
});

test('worker Python follows the selected CLI environment before a managed installation', () => {
  const { service, context } = localSpeech();
  service._getUserDataWhisperCandidate = () => ({ command: 'C:\\managed\\python.exe' });
  assert.equal(service._getWhisperPythonPath(), 'C:\\custom-venv\\Scripts\\python.exe');
  context.process.env.WHISPER_PYTHON = 'C:\\override\\python.exe';
  assert.equal(service._getWhisperPythonPath(), 'C:\\override\\python.exe');
  service.runtimeSettings.whisperDevice = 'cpu';
  assert.equal(service._getWhisperDevice(), 'cpu');
});
