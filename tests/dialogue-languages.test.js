const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const languages = require('../src/core/dialogue-languages');

test('dialogue preferences preserve legacy choices and explicit auto overrides them', () => {
  assert.deepEqual(languages.getDialogueLanguages({}), []);
  assert.deepEqual(languages.getDialogueLanguages({ GEMINI_TRANSCRIBE_LANGUAGES: 'ru-RU,en-US' }), ['ru-RU', 'en-US']);
  assert.deepEqual(languages.getDialogueLanguages({ WHISPER_LANGUAGE: 'ru' }), ['ru-RU']);
  assert.deepEqual(languages.getDialogueLanguages({ DIALOGUE_LANGUAGES: '', GEMINI_TRANSCRIBE_LANGUAGES: 'ru-RU' }), []);
  assert.deepEqual(languages.getDialogueLanguages({ DIALOGUE_LANGUAGES: 'ru-ru,en-US,ru-RU' }), ['ru-RU', 'en-US']);
  assert.throws(() => languages.getDialogueLanguages({ DIALOGUE_LANGUAGES: 'invented' }));
  assert.equal(languages.getDialogueInstruction({}), '');
  assert.match(languages.getDialogueInstruction({ DIALOGUE_LANGUAGES: 'ru-RU,en-US' }), /otherwise use Russian/);
});

test('speech providers use global languages and safe Whisper identifiers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/speech.service.js'), 'utf8');
  const speechConfig = { setProperty() {} };
  const context = { EventEmitter, process: { env: { DIALOGUE_LANGUAGES: 'ru-RU', WHISPER_LANGUAGE: 'en', AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: 'test' } },
    config: { get: () => ({ language: 'en-US' }) }, logger: { info() {} },
    sdk: { SpeechConfig: { fromSubscription: () => speechConfig }, OutputFormat: { Detailed: 1 }, PropertyId: {} },
    require: name => {
      if (name === '../core/dialogue-languages') return languages;
      throw new Error(name);
    } };
  vm.runInNewContext(source.slice(source.indexOf('class SpeechService extends EventEmitter {'), source.indexOf('module.exports = new SpeechService();')) + '\nthis.Speech = SpeechService;', context);
  const speech = Object.create(context.Speech.prototype);
  speech.runtimeSettings = {};
  assert.equal(speech._getWhisperLanguage(), 'ru');
  assert.deepEqual(speech._getGeminiTranscribeLanguages(), ['ru-RU']);
  speech._initializeAzureClient();
  assert.equal(speechConfig.speechRecognitionLanguage, 'ru-RU');
  context.process.env.DIALOGUE_LANGUAGES = 'ru-RU,en-US';
  assert.equal(speech._getWhisperLanguage(), 'auto');
  assert.deepEqual(speech._getGeminiTranscribeLanguages(), ['ru-RU', 'en-US']);
  speech._initializeAzureClient();
  assert.equal(speechConfig.speechRecognitionLanguage, 'ru-RU');
  context.process.env.DIALOGUE_LANGUAGES = '';
  assert.equal(speech._getWhisperLanguage(), 'auto');
  speech._initializeAzureClient();
  assert.equal(speechConfig.speechRecognitionLanguage, 'en-US');
  for (const [code, expected] of [['cmn-Hans-CN', 'zh'], ['nb-NO', 'no'], ['fil-PH', 'tl'], ['kea-CV', 'auto']]) {
    assert.equal(languages.getWhisperLanguage([code]), expected);
  }
});
