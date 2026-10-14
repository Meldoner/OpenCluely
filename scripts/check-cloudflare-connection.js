// Sends only a fixed connection-test prompt. Never prints credentials or audio.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getAISettings } = require('../src/core/ai-settings');
const { configureNetworkSession } = require('../src/core/network-session');
const settingsFile = process.argv[2] || path.join(process.env.APPDATA || '', 'opencluely', '.env');
const settings = getAISettings({ ...dotenv.parse(fs.readFileSync(settingsFile)), LLM_PROVIDER: 'cloudflare' });
if (!settings.configured) throw new Error('Cloudflare credentials are not configured');
const { complete } = require('../src/services/openai-compatible.service');
async function run(electron) {
  try {
    const request = { contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }], generationConfig: { maxOutputTokens: 1024 } };
    const answer = await complete(request, undefined, settings);
    let deltaCharacters = 0;
    let deltaEvents = 0;
    let completed = false;
    let receivedBeforeCompletion = false;
    const streamingRequest = { ...request, contents: [{ role: 'user', parts: [{ text: 'Explain how streaming responses work in four short sentences.' }] }] };
    const streamed = await complete(streamingRequest, delta => {
      deltaCharacters += delta.length;
      deltaEvents++;
      receivedBeforeCompletion = receivedBeforeCompletion || !completed;
    }, settings);
    completed = true;
    console.log(JSON.stringify({ provider: 'cloudflare', transport: electron ? 'electron_net' : 'node_https',
      connectionTestSucceeded: Boolean(answer), streamedChatSucceeded: Boolean(streamed && deltaCharacters), deltaCharacters,
      deltaEvents, receivedBeforeCompletion }));
    if (electron) electron.app.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ provider: 'cloudflare', status: error.status, errorCode: error.code,
      message: String(error.message).split(settings.apiKey).join('[redacted]').split(settings.accountId).join('[account]') }));
    if (electron) electron.app.exit(1); else process.exitCode = 1;
  }
}
if (process.versions.electron) {
  const electron = require('electron');
  electron.app.whenReady().then(() => {
    configureNetworkSession(electron.session.defaultSession);
    return run(electron);
  });
}
else run();
