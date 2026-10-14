(function (root) {
  // BCP-47 hints documented for Gemini 3.5 Transcribe Live:
  // https://ai.google.dev/gemini-api/docs/live-api/live-transcribe
  const LANGUAGES = [
    ['af-ZA', 'Afrikaans'], ['am-ET', 'Amharic'], ['ar-EG', 'Arabic (Egypt)'],
    ['hy-AM', 'Armenian'], ['as-IN', 'Assamese'], ['az-AZ', 'Azerbaijani'],
    ['be-BY', 'Belarusian'], ['bn-BD', 'Bengali (Bangladesh)'], ['bn-IN', 'Bengali (India)'],
    ['bs-BA', 'Bosnian'], ['bg-BG', 'Bulgarian'], ['rup-BG', 'Bulgarian (Aromanian)'],
    ['my-MM', 'Burmese'], ['yue-Hant-HK', 'Cantonese (Traditional)'], ['ca-ES', 'Catalan'],
    ['ceb', 'Cebuano'], ['km-KH', 'Central Khmer'], ['cmn-Hans-CN', 'Chinese (Simplified)'],
    ['hr-HR', 'Croatian'], ['cs-CZ', 'Czech'], ['da-DK', 'Danish'], ['nl-NL', 'Dutch'],
    ['en-GB', 'English (Great Britain)'], ['en-IN', 'English (India)'], ['en-US', 'English (United States)'],
    ['et-EE', 'Estonian'], ['fa-IR', 'Farsi'], ['fil-PH', 'Filipino'], ['fi-FI', 'Finnish'],
    ['fr-FR', 'French'], ['gl-ES', 'Galician'], ['ka-GE', 'Georgian'], ['de-DE', 'German'],
    ['el-GR', 'Greek'], ['gu-IN', 'Gujarati'], ['ha-NG', 'Hausa'], ['he-IL', 'Hebrew'],
    ['hi-IN', 'Hindi'], ['hu-HU', 'Hungarian'], ['is-IS', 'Icelandic'], ['id-ID', 'Indonesian'],
    ['it-IT', 'Italian'], ['ja-JP', 'Japanese'], ['jv-ID', 'Javanese'], ['kea-CV', 'Kabuverdianu'],
    ['kn-IN', 'Kannada'], ['kk-KZ', 'Kazakh'], ['ko-KR', 'Korean'], ['ky-KG', 'Kyrgyz'],
    ['lv-LV', 'Latvian'], ['ln-CD', 'Lingala'], ['lt-LT', 'Lithuanian'], ['mk-MK', 'Macedonian'],
    ['ms-MY', 'Malay'], ['ml-IN', 'Malayalam'], ['mt-MT', 'Maltese'], ['mr-IN', 'Marathi'],
    ['mn-MN', 'Mongolian'], ['ne-NP', 'Nepali'], ['nb-NO', 'Norwegian'], ['or-IN', 'Oriya'],
    ['pl-PL', 'Polish'], ['pt-BR', 'Portuguese (Brazil)'], ['pt-PT', 'Portuguese (Portugal)'],
    ['pa-IN', 'Punjabi'], ['pa-Guru-IN', 'Punjabi (Gurmukhi script)'], ['ro-RO', 'Romanian'],
    ['ru-RU', 'Russian'], ['sr-RS', 'Serbian'], ['sd-Arab-IN', 'Sindhi (Arabic script)'],
    ['sk-SK', 'Slovak'], ['sl-SI', 'Slovenian'], ['es-ES', 'Spanish (Spain)'],
    ['es-419', 'Spanish (Latin America)'], ['es-US', 'Spanish (United States)'],
    ['sw-KE', 'Swahili (Kenya)'], ['sv-SE', 'Swedish'], ['tg-TJ', 'Tajik'], ['te-IN', 'Telugu'],
    ['th-TH', 'Thai'], ['tr-TR', 'Turkish'], ['uk-UA', 'Ukrainian'], ['uz-UZ', 'Uzbek'], ['vi-VN', 'Vietnamese']
  ];
  const canonical = new Map(LANGUAGES.map(([code]) => [code.toLowerCase(), code]));
  function parse(value = '') {
    if (typeof value === 'string') {
      if (value.length > 4096 || /[\r\n]/.test(value)) throw new Error('Invalid Gemini transcription languages');
      if (!value.trim() || value.trim().toLowerCase() === 'auto') return [];
      value = value.split(',');
    }
    if (!Array.isArray(value) || value.length > LANGUAGES.length) throw new Error('Invalid Gemini transcription languages');
    const result = [];
    for (const item of value) {
      if (typeof item !== 'string') throw new Error('Invalid Gemini transcription language');
      const code = canonical.get(item.trim().toLowerCase());
      if (!code) throw new Error('Unsupported Gemini transcription language');
      if (!result.includes(code)) result.push(code);
    }
    return result;
  }
  const api = { LANGUAGES, parse };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GeminiTranscribeLanguages = api;
})(typeof window === 'object' ? window : globalThis);
