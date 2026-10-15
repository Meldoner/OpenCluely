// Speech biasing hints for Gemini Transcribe, never transcript replacement rules.
const DEFAULT_VOCABULARY = ['KVCache', 'KV cache', 'key-value cache'];

function parseVocabulary(value = '') {
  if (typeof value === 'string') {
    if (value.length > 4096 || /[\r\n]/.test(value)) throw new Error('Invalid transcription vocabulary');
    value = value.split(',').filter(term => term.trim());
  }
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use at most 100 transcription terms');
  const result = [];
  for (const term of value) {
    if (typeof term !== 'string' || !term.trim() || term.length > 100 || /[\r\n,\x00-\x1f]/.test(term)) throw new Error('Invalid transcription term');
    if (!result.includes(term.trim())) result.push(term.trim());
  }
  if (result.join(',').length > 4096) throw new Error('Transcription vocabulary is too long');
  return result;
}

module.exports = { DEFAULT_VOCABULARY, parseVocabulary };
