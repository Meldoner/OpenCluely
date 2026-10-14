// Real Electron renderers and preload, mocked providers: no API calls or recording.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const catalogue = require('../src/core/skills');
const { DEFAULTS } = require('../src/core/ai-settings');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'opencluely-ui-test-'));
app.setPath('userData', temporary);
const settings = { llmProvider: 'openai', openaiKey: 'test-key', openaiModel: DEFAULTS.openaiModel,
  openaiBaseUrl: DEFAULTS.openaiBaseUrl, speechProvider: 'cloudflare',
  cloudflareAccountId: 'a'.repeat(32), cloudflareToken: 'test-token', cloudflareModel: DEFAULTS.cloudflareModel,
  cloudflareWhisperModel: DEFAULTS.cloudflareWhisperModel, codingLanguage: 'go', activeSkill: 'backend',
  whisperCaptureMode: 'vad', whisperDevice: 'auto', whisperResponseTarget: 'both', whisperSegmentMs: '4000' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const captureErrors = [];
ipcMain.handle('get-settings', () => settings);
ipcMain.handle('save-settings', (_event, data) => { Object.assign(settings, data); return { success: true }; });
ipcMain.on('save-settings', (_event, data) => Object.assign(settings, data));
ipcMain.handle('get-available-skills', () => catalogue);
ipcMain.handle('get-window-stats', () => ({ isInteractive: true }));
ipcMain.handle('get-speech-availability', () => true);
ipcMain.handle('resize-window', () => true);
ipcMain.handle('resize-llm-window-for-content', () => true);
ipcMain.handle('update-active-skill', (_event, skill) => { settings.activeSkill = skill; return { success: true }; });
ipcMain.handle('test-llm-connection', () => ({ success: true, model: 'mock-model' }));
ipcMain.handle('get-audio-capture-settings', () => ({ platform: 'win32' }));
ipcMain.on('audio-capture-error', (_event, message) => captureErrors.push(message));
ipcMain.handle('send-chat-message', event => {
  event.sender.send('llm-error', { error: 'Cloudflare test error: connection failed' });
  return { success: true };
});

async function load(file, size) {
  const window = new BrowserWindow({ show: false, width: size[0], height: size[1], webPreferences: {
    preload: path.join(root, 'preload.js'), nodeIntegration: false, contextIsolation: true, backgroundThrottling: false
  } });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3 && !message.includes('ERR_FILE_NOT_FOUND')) errors.push(message);
  });
  await window.loadFile(path.join(root, file));
  await delay(400);
  return { window, errors, execute: source => window.webContents.executeJavaScript(source) };
}

app.whenReady().then(async () => {
  try {
    const settingsUI = await load('settings.html', [760, 820]);
    assert.equal(await settingsUI.execute(`document.getElementById('ai-openaiKey').value`), 'test-key');
    assert.equal(await settingsUI.execute(`document.getElementById('activeSkill').options.length`), 6);
    assert.equal(await settingsUI.execute(`document.getElementById('codingLanguage').value`), 'go');
    assert.equal(await settingsUI.execute(`document.getElementById('cloudflareSpeechFields').hidden`), false);
    await settingsUI.execute(`document.getElementById('ai-openaiModel').value = 'custom-model'; document.getElementById('ai-openaiModel').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(settings.openaiModel, 'custom-model');
    await settingsUI.execute(`document.getElementById('cloudflareWhisperModel').value = '@cf/openai/whisper-large-v3-turbo'; document.getElementById('cloudflareWhisperModel').dispatchEvent(new Event('change')); document.getElementById('whisperLanguage').value = 'ru'; document.getElementById('whisperLanguage').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(settings.cloudflareWhisperModel, '@cf/openai/whisper-large-v3-turbo');
    assert.equal(settings.whisperLanguage, 'ru');
    assert.equal(await settingsUI.execute(`document.getElementById('whisperLanguage').disabled`), false);
    assert.deepEqual(settingsUI.errors, []);

    const onboarding = await load('onboarding.html', [960, 820]);
    await onboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    assert.equal(await onboarding.execute(`document.querySelector('.screen.active').dataset.screen`), 'apikey');
    await onboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    await onboarding.execute(`document.querySelector('[data-value="cloudflare"]').click();`);
    assert.equal(await onboarding.execute(`document.getElementById('cloudflareSpeechToken').value`), 'test-token');
    await onboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    assert.equal(await onboarding.execute(`document.querySelector('.screen.active').dataset.screen`), 'finish');
    assert.equal(settings.speechProvider, 'cloudflare');
    assert.deepEqual(onboarding.errors, []);

    const chat = await load('chat.html', [800, 820]);
    await chat.execute(`document.getElementById('messageInput').value = 'Test request'; document.getElementById('sendButton').click();`);
    await delay(450);
    assert.equal(await chat.execute(`Boolean(document.getElementById('thinking-indicator'))`), false);
    assert.match(await chat.execute(`document.querySelector('.message.error').textContent`), /Cloudflare test error/);
    await chat.execute(`document.getElementById('messageInput').value = 'Test Enter request'; document.getElementById('messageInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    await delay(450);
    assert.equal(await chat.execute(`Boolean(document.getElementById('thinking-indicator'))`), false);
    assert.deepEqual(chat.errors, []);

    const response = await load('llm-response.html', [840, 480]);
    const send = (target, channel, data) => target.window.webContents.send(channel, data);
    const start = (target, id) => send(target, 'transcription-llm-response-start', { messageId: id });
    const chunk = (target, id, delta) => send(target, 'transcription-llm-response-chunk', { messageId: id, delta });
    const finish = (target, id, text) => send(target, 'transcription-llm-response', { messageId: id, response: text });
    for (const target of [chat, response]) {
      start(target, 'stream-first');
      chunk(target, 'stream-first', 'Привет');
    }
    await delay(100);
    assert.equal(await chat.execute(`document.querySelector('[data-message-id="stream-first"] .message-text').textContent`), 'Привет');
    assert.equal(await response.execute(`document.getElementById('full-markdown').textContent`), 'Привет');
    assert.equal(await response.execute(`document.getElementById('loading').classList.contains('hidden')`), true);
    assert.equal(await chat.execute(`Boolean(document.getElementById('thinking-indicator'))`), false);
    // Final formatting replaces partial text, including an incomplete code fence.
    const finalText = 'Привет!\n\n```go\nfmt.Println("мир")\n```';
    for (const target of [chat, response]) {
      chunk(target, 'stream-first', '!\n\n```go\nfmt.');
      finish(target, 'stream-first', finalText);
      finish(target, 'stream-first', finalText);
    }
    send(response, 'display-llm-response', { content: finalText, metadata: { messageId: 'stream-first' } });
    await delay(250);
    assert.equal(await chat.execute(`document.querySelectorAll('[data-message-id="stream-first"]').length`), 1);
    assert.equal(await chat.execute(`document.querySelector('[data-message-id="stream-first"] code').textContent.trim()`), 'fmt.Println("мир")');
    assert.equal(await response.execute(`document.querySelectorAll('#code-content .copy-btn').length`), 1);
    assert.equal(await chat.execute(`JSON.parse(localStorage.getItem('opencluely_chat_history_v1')).filter(item => item.text === ${JSON.stringify(finalText)}).length`), 1);
    // Concurrent streams stay separate; identical answers from different requests survive.
    start(chat, 'parallel-a'); start(chat, 'parallel-b');
    chunk(chat, 'parallel-a', 'A'); chunk(chat, 'parallel-b', 'B'); chunk(chat, 'parallel-a', '1');
    await delay(100);
    assert.equal(await chat.execute(`document.querySelector('[data-message-id="parallel-a"] .message-text').textContent`), 'A1');
    assert.equal(await chat.execute(`document.querySelector('[data-message-id="parallel-b"] .message-text').textContent`), 'B');
    finish(chat, 'parallel-a', 'Same answer'); finish(chat, 'parallel-b', 'Same answer');
    await delay(100);
    assert.equal(await chat.execute(`Array.from(document.querySelectorAll('.message.assistant .message-text')).filter(item => item.textContent === 'Same answer').length`), 2);
    // Failure preserves received text and rejects late chunks/final events.
    for (const target of [chat, response]) {
      start(target, 'stream-error'); chunk(target, 'stream-error', 'Partial answer');
      send(target, 'llm-error', { messageId: 'stream-error', error: 'Connection interrupted' });
      chunk(target, 'stream-error', ' stale'); finish(target, 'stream-error', 'Should not appear');
    }
    await delay(100);
    assert.equal(await chat.execute(`document.querySelector('[data-message-id="stream-error"] .message-text').textContent`), 'Partial answer');
    assert.match(await response.execute(`document.getElementById('full-markdown').textContent`), /Partial answer\n\nConnection interrupted/);
    // Overlay displays the latest request rather than an older completion.
    start(response, 'older'); chunk(response, 'older', 'Old');
    start(response, 'newer'); chunk(response, 'newer', 'New');
    finish(response, 'older', 'Old final');
    await delay(100);
    assert.equal(await response.execute(`document.getElementById('full-markdown').textContent`), 'New');
    finish(response, 'newer', 'New final');
    // Clearing during generation prevents cleared requests from resurrecting.
    for (const target of [chat, response]) {
      start(target, 'cleared'); chunk(target, 'cleared', '<img src=x onerror="window.streamInjection=true">');
    }
    await delay(100);
    assert.equal(await chat.execute(`document.querySelector('[data-message-id="cleared"] img') === null`), true);
    for (const target of [chat, response]) {
      send(target, 'session-cleared');
      chunk(target, 'cleared', 'late'); finish(target, 'cleared', 'Late final');
      send(target, 'llm-error', { messageId: 'cleared', error: 'Late failure' });
    }
    await delay(100);
    assert.equal(await chat.execute(`document.querySelectorAll('.message.assistant').length`), 0);
    assert.equal(await response.execute(`document.getElementById('full-markdown').textContent`), '');
    assert.deepEqual(chat.errors, []);
    assert.deepEqual(response.errors, []);

    const overlay = await load('index.html', [720, 200]);
    assert.equal(await overlay.execute(`window.mainWindowUI.currentSkill`), 'backend');
    assert.equal(await overlay.execute(`document.getElementById('activeSkill').value`), 'backend');
    assert.equal(await overlay.execute(`document.getElementById('codingLanguage').value`), 'go');
    assert.equal(await overlay.execute(`typeof SystemAudioCapture`), 'function');
    assert.equal(await overlay.execute(`document.getElementById('activeSkill').disabled`), false);
    assert.deepEqual(overlay.errors, []);
    assert.deepEqual(captureErrors, []);
    console.log('Electron UI smoke checks passed: settings, onboarding, chat errors, live response streaming, concurrent requests, final code formatting and clearing.');
    app.exit(0);
  } catch (error) {
    console.error('UI smoke check failed:', error.message);
    app.exit(1);
  }
});
app.on('window-all-closed', () => {});
