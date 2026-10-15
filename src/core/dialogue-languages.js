const { LANGUAGES, parse } = require('./gemini-transcribe-languages');
const { DEFAULTS } = require('./ai-settings');

function getDialogueLanguages(env = process.env) {
  if (env.DIALOGUE_LANGUAGES !== undefined) return parse(env.DIALOGUE_LANGUAGES);
  // Preserve existing selections until the global preference is first saved.
  const hints = parse(env.GEMINI_TRANSCRIBE_LANGUAGES ?? DEFAULTS.dialogueLanguages);
  if (hints.length) return hints;
  const legacy = String(env.WHISPER_LANGUAGE || '').toLowerCase();
  const match = LANGUAGES.find(([code]) => code.split('-')[0] === legacy);
  return match ? [match[0]] : [];
}

function getDialogueInstruction(env = process.env) {
  const codes = getDialogueLanguages(env);
  if (!codes.length) return '';
  const names = codes.map(code => LANGUAGES.find(([value]) => value === code)[1]);
  return `Global dialogue language preference (takes precedence over instructions to match the question's language): ${names.join(', ')}. ` +
    (codes.length === 1 ? `Write answer explanations in ${names[0]}.` :
      `Use the question's language when it is among these languages; otherwise use ${names[0]}.`) +
    ' This applies to typed, spoken and screenshot questions. Keep code in the selected programming language and preserve the concise interview style.';
}

function getWhisperLanguage(codes) {
  if (codes.length !== 1) return 'auto';
  const base = codes[0].split('-')[0];
  // Whisper uses ISO language identifiers rather than BCP-47 hints.
  const aliases = { cmn: 'zh', nb: 'no', fil: 'tl', yue: 'zh' };
  const supported = new Set('af am ar hy as az be bn bs bg my ca zh hr cs da nl en et fa tl fi fr gl ka de el gu ha he hi hu is id it ja jw kn kk ko lv ln lt mk ms ml mt mr mn ne no nn or pl pt pa ro ru sr sd sk sl es sw sv tg te th tr uk uz vi'.split(' '));
  const language = aliases[base] || (base === 'jv' ? 'jw' : base);
  return supported.has(language) ? language : 'auto';
}

module.exports = { getDialogueLanguages, getDialogueInstruction, getWhisperLanguage };
