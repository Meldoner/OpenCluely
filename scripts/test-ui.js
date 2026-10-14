// Real Electron renderers and preload, mocked providers: no API calls or recording.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const catalogue = require('../src/core/skills');
const { DEFAULTS } = require('../src/core/ai-settings');
const GeminiLiveTransport = require('../src/services/gemini-live-transport');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'opencluely-ui-test-'));
app.setPath('userData', temporary);
const settings = { llmProvider: 'openai', openaiKey: 'test-key', openaiModel: DEFAULTS.openaiModel,
  openaiBaseUrl: DEFAULTS.openaiBaseUrl, speechProvider: 'cloudflare',
  cloudflareAccountId: 'a'.repeat(32), cloudflareToken: 'test-token', cloudflareModel: DEFAULTS.cloudflareModel,
  cloudflareWhisperModel: DEFAULTS.cloudflareWhisperModel, geminiTranscribeLanguages: [], codingLanguage: 'go', activeSkill: 'backend',
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

    await settingsUI.execute(`document.querySelector('#aiProviderSettings select').value = 'gemini-live'; document.querySelector('#aiProviderSettings select').dispatchEvent(new Event('change')); document.getElementById('ai-geminiKey').value = 'test-gemini-key'; document.getElementById('ai-geminiKey').dispatchEvent(new Event('change')); document.getElementById('speechProvider').value = 'gemini-live'; document.getElementById('speechProvider').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(settings.llmProvider, 'gemini-live');
    assert.equal(settings.speechProvider, 'gemini-live');
    assert.equal(await settingsUI.execute(`document.getElementById('speechProvider').disabled`), false);
    assert.match(await settingsUI.execute(`document.getElementById('speechProvider').selectedOptions[0].textContent`), /Gemini-3.5-Transcribe Live/);
    assert.equal(await settingsUI.execute(`document.getElementById('geminiTranscribeLanguageFields').hidden`), false);
    assert.equal(settings.geminiKey, 'test-gemini-key');
    assert.equal(await settingsUI.execute(`document.getElementById('ai-geminiKey').parentElement.hidden`), false);
    assert.equal(await settingsUI.execute(`document.getElementById('geminiLiveSpeechFields').hidden`), false);
    assert.equal(await settingsUI.execute(`document.getElementById('whisperCaptureMode').disabled`), false);
    assert.equal(await settingsUI.execute(`document.getElementById('whisperLanguage').closest('.settings-item').hidden`), true);
    await settingsUI.execute(`document.getElementById('speechProvider').value = 'gemini-live-audio'; document.getElementById('speechProvider').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(settings.speechProvider, 'gemini-live-audio');
    assert.equal(settings.llmProvider, 'gemini-live');
    assert.equal(await settingsUI.execute(`document.getElementById('geminiTranscribeLanguageFields').hidden`), true);
    for (const provider of ['whisper', 'azure', 'cloudflare']) {
      await settingsUI.execute(`document.getElementById('speechProvider').value = '${provider}'; document.getElementById('speechProvider').dispatchEvent(new Event('change'));`);
      await delay(100);
      assert.equal(settings.speechProvider, provider);
      assert.equal(settings.llmProvider, 'gemini-live');
    }
    assert.equal(await settingsUI.execute(`document.getElementById('cloudflareSpeechFields').hidden`), false);
    assert.equal(await settingsUI.execute(`document.getElementById('ai-cloudflareToken').parentElement.hidden`), false);
    await settingsUI.execute(`document.getElementById('speechProvider').value = 'gemini-live-audio'; document.getElementById('speechProvider').dispatchEvent(new Event('change')); document.querySelector('#aiProviderSettings select').value = 'openai'; document.querySelector('#aiProviderSettings select').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(settings.speechProvider, 'gemini-live');
    // Restore the original onboarding scenario after testing Live selection.
    await settingsUI.execute(`document.querySelector('#aiProviderSettings select').value = 'openai'; document.querySelector('#aiProviderSettings select').dispatchEvent(new Event('change')); document.getElementById('speechProvider').value = 'cloudflare'; document.getElementById('speechProvider').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(await settingsUI.execute(`document.getElementById('whisperLanguage').closest('.settings-item').hidden`), false);
    assert.equal(await settingsUI.execute(`document.getElementById('speechProvider').disabled`), false);
    assert.deepEqual(settingsUI.errors, []);

    // Load the actual sandboxed preload without opening a network connection.
    const transport = new GeminiLiveTransport();
    const transportErrors = [];
    transport.on('error', error => transportErrors.push(error));
    transport.start('wss://example.invalid/');
    transport.window.webContents.on('console-message', (_event, level, message) => {
      if (level >= 3) transportErrors.push(message);
    });
    await delay(400);
    assert.equal(transport.window.isVisible(), false);
    const preferences = transport.window.webContents.getLastWebPreferences();
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.sandbox, true);
    assert.deepEqual(transportErrors, []);
    transport.close();

    await settingsUI.execute(`document.getElementById('speechProvider').value = 'gemini-live'; document.getElementById('speechProvider').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(await settingsUI.execute(`document.getElementById('geminiTranscribeLanguageFields').hidden`), false);
    await settingsUI.execute(`document.querySelector('#geminiTranscribeLanguageFields input[value="ru-RU"]').click(); document.querySelector('#geminiTranscribeLanguageFields input[value="en-US"]').click();`);
    await delay(100);
    assert.deepEqual([...settings.geminiTranscribeLanguages].sort(), ['en-US', 'ru-RU']);
    settingsUI.window.webContents.send('load-settings', settings);
    await delay(100);
    assert.equal(await settingsUI.execute(`document.querySelector('#geminiTranscribeLanguageFields input[value="ru-RU"]').checked`), true);
    assert.equal(await settingsUI.execute(`document.querySelector('#geminiTranscribeLanguageFields input[value="en-US"]').checked`), true);
    await settingsUI.execute(`document.querySelector('#geminiTranscribeLanguageFields input[type="search"]').value = 'Russian'; document.querySelector('#geminiTranscribeLanguageFields input[type="search"]').dispatchEvent(new Event('input'));`);
    assert.equal(await settingsUI.execute(`getComputedStyle(document.querySelector('#geminiTranscribeLanguageFields input[value="ru-RU"]').parentElement).display`), 'flex');
    assert.equal(await settingsUI.execute(`getComputedStyle(document.querySelector('#geminiTranscribeLanguageFields input[value="en-US"]').parentElement).display`), 'none');
    await settingsUI.execute(`document.querySelector('#geminiTranscribeLanguageFields button').click();`);
    await delay(100);
    assert.deepEqual(settings.geminiTranscribeLanguages, []);
    await settingsUI.execute(`document.querySelector('#geminiTranscribeLanguageFields input[value="ru-RU"]').click(); document.querySelector('#geminiTranscribeLanguageFields input[value="en-US"]').click(); document.getElementById('speechProvider').value = 'cloudflare'; document.getElementById('speechProvider').dispatchEvent(new Event('change'));`);
    await delay(100);
    assert.equal(await settingsUI.execute(`document.getElementById('geminiTranscribeLanguageFields').hidden`), true);
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

    const liveOnboarding = await load('onboarding.html', [960, 820]);
    await liveOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    await liveOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    await liveOnboarding.execute(`document.querySelector('[data-value="gemini-live"]').click();`);
    assert.equal(await liveOnboarding.execute(`document.getElementById('geminiLiveSpeechKey').value`), 'test-gemini-key');
    assert.equal(await liveOnboarding.execute(`document.querySelector('#geminiTranscribeOnboardingLanguages input[value="ru-RU"]').checked`), true);
    assert.equal(await liveOnboarding.execute(`document.querySelector('#geminiTranscribeOnboardingLanguages input[value="en-US"]').checked`), true);
    await liveOnboarding.execute(`document.querySelector('#geminiTranscribeOnboardingLanguages input[value="fr-FR"]').click();`);
    await liveOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    assert.equal(settings.speechProvider, 'gemini-live');
    assert.deepEqual([...settings.geminiTranscribeLanguages].sort(), ['en-US', 'fr-FR', 'ru-RU']);
    assert.equal(await liveOnboarding.execute(`document.querySelector('.screen.active').dataset.screen`), 'finish');
    assert.deepEqual(liveOnboarding.errors, []);

    const audioOnboarding = await load('onboarding.html', [960, 820]);
    await audioOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    await audioOnboarding.execute(`document.querySelector('#onboardingProviderSettings select').value = 'gemini-live'; document.querySelector('#onboardingProviderSettings select').dispatchEvent(new Event('change')); document.getElementById('nextBtn').click();`);
    await delay(100);
    assert.equal(await audioOnboarding.execute(`document.querySelector('#speechChoices [data-value="whisper"]').hidden`), false);
    assert.notEqual(await audioOnboarding.execute(`getComputedStyle(document.querySelector('#speechChoices [data-value="whisper"]')).display`), 'none');
    await audioOnboarding.execute(`document.querySelector('#speechChoices [data-value="gemini-live-audio"]').click();`);
    assert.equal(await audioOnboarding.execute(`document.querySelector('#speechChoices [data-value="gemini-live-audio"]').classList.contains('selected')`), true);
    assert.equal(await audioOnboarding.execute(`getComputedStyle(document.getElementById('geminiTranscribeOnboardingLanguages')).display`), 'none');
    await audioOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    assert.equal(settings.speechProvider, 'gemini-live-audio');
    assert.equal(await audioOnboarding.execute(`document.querySelector('.screen.active').dataset.screen`), 'finish');
    assert.deepEqual(audioOnboarding.errors, []);

    const independentOnboarding = await load('onboarding.html', [960, 820]);
    await independentOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    await independentOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    await independentOnboarding.execute(`document.querySelector('#speechChoices [data-value="gemini-live"]').click();`);
    assert.notEqual(await independentOnboarding.execute(`getComputedStyle(document.getElementById('geminiTranscribeOnboardingLanguages')).display`), 'none');
    await independentOnboarding.execute(`document.getElementById('nextBtn').click();`);
    await delay(100);
    assert.equal(settings.speechProvider, 'gemini-live');
    assert.equal(settings.llmProvider, 'gemini-live');
    assert.equal(await independentOnboarding.execute(`document.querySelector('.screen.active').dataset.screen`), 'finish');
    assert.deepEqual(independentOnboarding.errors, []);

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

    // Streaming follows the bottom only while the reader stays there.
    const longAnswer = Array.from({ length: 100 }, (_, i) => `Paragraph ${i}. Text for the scrolling regression.`).join('\n\n');
    const chatScroll = () => chat.execute(`(() => {
      const messages = document.getElementById('chatMessages');
      return { top: messages.scrollTop, bottom: messages.scrollHeight - messages.clientHeight - messages.scrollTop };
    })()`);
    start(chat, 'scroll-follow'); chunk(chat, 'scroll-follow', longAnswer);
    await delay(100);
    let position = await chatScroll();
    assert.ok(position.top > 500, 'The answer must overflow the chat viewport');
    assert.ok(position.bottom <= 1, 'New text follows the bottom initially');
    // Even a small upward scroll must pause following, without a large threshold.
    await chat.execute(`document.getElementById('chatMessages').scrollTop -= 12;`);
    const nearBottom = await chatScroll();
    chunk(chat, 'scroll-follow', '\n\nAnother paragraph.');
    await delay(100);
    assert.ok(Math.abs((await chatScroll()).top - nearBottom.top) <= 1, 'A chunk must respect a small upward scroll');
    await chat.execute(`document.getElementById('chatMessages').scrollTop = 240;`);
    const readingPosition = (await chatScroll()).top;
    chunk(chat, 'scroll-follow', '\n\nMore streamed text.');
    start(chat, 'scroll-parallel'); chunk(chat, 'scroll-parallel', longAnswer);
    await delay(100);
    assert.ok(Math.abs((await chatScroll()).top - readingPosition) <= 1, 'Concurrent chunks and indicators must preserve the reading position');
    finish(chat, 'scroll-follow', `**Completed.**\n\n${longAnswer}\n\nAnother paragraph.\n\nMore streamed text.`);
    send(chat, 'llm-error', { messageId: 'scroll-parallel', error: 'Scrolling test interruption' });
    await delay(100);
    assert.ok(Math.abs((await chatScroll()).top - readingPosition) <= 1, 'Final Markdown and errors must preserve the reading position');
    start(chat, 'scroll-resume'); chunk(chat, 'scroll-resume', longAnswer);
    await delay(100);
    assert.ok(Math.abs((await chatScroll()).top - readingPosition) <= 1, 'A new response must respect the reading position');
    await chat.execute(`document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;`);
    chunk(chat, 'scroll-resume', '\n\nFollowing again.');
    await delay(100);
    position = await chatScroll();
    assert.ok(position.bottom <= 1, 'Returning to the bottom resumes following');
    finish(chat, 'scroll-resume', `${longAnswer}\n\nFollowing again.`);
    await delay(100);
    assert.ok((await chatScroll()).bottom <= 1, 'Final formatting keeps following when already at the bottom');
    await chat.execute(`document.getElementById('chatMessages').scrollTop = 240;`);
    send(chat, 'session-cleared');
    start(chat, 'scroll-after-clear'); chunk(chat, 'scroll-after-clear', longAnswer);
    await delay(100);
    assert.ok((await chatScroll()).bottom <= 1, 'Clearing resets following for the next answer');
    send(chat, 'session-cleared');
    assert.deepEqual(chat.errors, []);

    const overlay = await load('index.html', [720, 200]);
    assert.equal(await overlay.execute(`window.mainWindowUI.currentSkill`), 'backend');
    assert.equal(await overlay.execute(`document.getElementById('activeSkill').value`), 'backend');
    assert.equal(await overlay.execute(`document.getElementById('codingLanguage').value`), 'go');
    assert.equal(await overlay.execute(`typeof SystemAudioCapture`), 'function');
    assert.equal(await overlay.execute(`document.getElementById('activeSkill').disabled`), false);
    assert.deepEqual(overlay.errors, []);
    assert.deepEqual(captureErrors, []);
    console.log('Electron UI smoke checks passed: settings, onboarding, chat errors, live response streaming, concurrent requests, final code formatting, clearing and scrolling during generation.');
    app.exit(0);
  } catch (error) {
    console.error('UI smoke check failed:', error.message);
    app.exit(1);
  }
});
app.on('window-all-closed', () => {});
