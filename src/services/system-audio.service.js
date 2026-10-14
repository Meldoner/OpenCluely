const { spawn } = require('child_process');

// Native PulseAudio/PipeWire monitor capture. Never falls back to a microphone.
function startNativeCapture(onChunk, onError, platform = process.platform) {
  if (platform !== 'linux') throw new Error('Native system audio capture is only available on Linux.');
  const child = spawn('parec', ['--device=@DEFAULT_MONITOR@', '--format=s16le', '--rate=16000', '--channels=1', '--raw'],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stopped = false;
  let failed = false;
  const fail = () => {
    if (!stopped && !failed) { failed = true; onError(new Error('System audio capture failed. Install parec (pulseaudio-utils) and check the output monitor.')); }
  };
  let pending = Buffer.alloc(0);
  child.stdout.on('data', chunk => {
    const pcm = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    const length = pcm.length - pcm.length % 2;
    pending = pcm.subarray(length);
    if (length && !stopped) onChunk(pcm.subarray(0, length));
  });
  child.stderr.on('data', () => {});
  child.on('error', fail);
  child.on('close', fail);
  return { stop() { stopped = true; child.kill(); } };
}

module.exports = { startNativeCapture };
