// Run via scripts/run-electron.js to use Chromium's WebSocket and OS proxy.
const fs = require('fs');
const { app } = require('electron');
const live = require('../src/services/gemini-live.service');
const { parse: parseTranscribeLanguages } = require('../src/core/gemini-transcribe-languages');
const args = process.argv.slice(2);
const usage = 'Usage: node scripts/run-electron.js scripts/aistudio-live.js [--env path] --text "question" | --pcm path [--languages ru-RU,en-US]\n--pcm: raw mono 16-bit little-endian PCM, 16000 Hz (up to 9 minutes).\n--languages: comma-separated transcription language hints; auto enables automatic detection.';
const options = {};
for (let i = 0; i < args.length; i++) {
  const name = args[i];
  if (name === '--help') { console.log(usage); app.exit(0); }
  else if (['--env', '--text', '--pcm', '--languages'].includes(name) && args[i + 1] && !args[i + 1].startsWith('--')) options[name.slice(2)] = args[++i];
  else { console.error(usage); app.exit(1); }
}
if (!!options.text === !!options.pcm || (options.languages !== undefined && !options.pcm)) { console.error(usage); app.exit(1); }
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-background-networking');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
process.on('SIGINT', () => { live.shutdown(); app.exit(130); });

app.whenReady().then(async () => {
  try {
    // Reads only the explicitly selected file or inherited environment. This
    // utility never creates or writes a separate application settings file.
    const env = options.env ? require('dotenv').parse(fs.readFileSync(options.env)) : process.env;
    const apiKey = env.GEMINI_API_KEY;
    if (options.text) {
      await live.complete({ contents: [{ role: 'user', parts: [{ text: options.text }] }] },
        delta => process.stdout.write(delta), { apiKey });
      process.stdout.write('\n');
    } else {
      const info = fs.statSync(options.pcm);
      if (!info.isFile() || !info.size || info.size % 2 || info.size > 16000 * 2 * 540) throw new Error('Expected a nonempty PCM16 file up to 9 minutes');
      const audio = fs.readFileSync(options.pcm);
      const languageCodes = parseTranscribeLanguages(options.languages ?? env.GEMINI_TRANSCRIBE_LANGUAGES ?? '');
      const session = live.createTranscription({ apiKey, manual: true, languageCodes });
      session.on('content', content => {
        if (content.inputTranscription?.text) process.stdout.write(content.inputTranscription.text + '\n');
      });
      await session.connect();
      session.send({ realtimeInput: { activityStart: {} } });
      for (let offset = 0; offset < audio.length; offset += 3200) {
        session.sendAudio(audio.subarray(offset, offset + 3200));
        await delay(100);
      }
      await session.finish();
      session.close();
    }
    live.shutdown();
    app.exit(0);
  } catch (error) {
    console.error(error.message);
    live.shutdown();
    app.exit(1);
  }
});
