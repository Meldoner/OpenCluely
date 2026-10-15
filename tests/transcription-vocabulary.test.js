const test = require('node:test');
const assert = require('node:assert/strict');
const skills = require('../src/core/skills');
const { SKILL_VOCABULARIES, parseVocabulary, vocabularyEnvKey, getSkillVocabulary, legacyVocabularyUpdates } = require('../src/core/transcription-vocabulary');

test('every active skill has its own valid glossary matching its subject', () => {
  const examples = { dsa: 'BFS', devops: 'Kubernetes', analyst: 'ARPU', backend: 'MVCC', 'ml-engineer': 'CatBoost', 'ai-engineer': 'KVCache' };
  assert.deepEqual(Object.keys(SKILL_VOCABULARIES).sort(), skills.map(skill => skill.id).sort());
  const dictionaries = new Set();
  for (const { id } of skills) {
    const vocabulary = getSkillVocabulary(id, {});
    assert.ok(vocabulary.includes(examples[id]), id);
    assert.deepEqual(parseVocabulary(vocabulary.join(',')), vocabulary);
    dictionaries.add(vocabulary.join(','));
    vocabulary.push('Changed copy');
    assert.equal(getSkillVocabulary(id, {}).includes('Changed copy'), false);
  }
  assert.equal(dictionaries.size, skills.length);
});

test('overrides, including disabled hints, apply to one skill only', () => {
  const env = { GEMINI_TRANSCRIBE_VOCABULARY_AI_ENGINEER: 'CustomModel,KVCache', GEMINI_TRANSCRIBE_VOCABULARY_DEVOPS: '' };
  assert.deepEqual(getSkillVocabulary('ai-engineer', env), ['CustomModel', 'KVCache']);
  assert.deepEqual(getSkillVocabulary('devops', env), []);
  assert.ok(getSkillVocabulary('backend', env).includes('PostgreSQL'));
  assert.throws(() => vocabularyEnvKey('../bad'));
  assert.equal(vocabularyEnvKey('ml-engineer'), 'GEMINI_TRANSCRIBE_VOCABULARY_ML_ENGINEER');
});

test('legacy default gives way to profile defaults while custom or empty lists stay on the original profile', () => {
  const original = { ACTIVE_SKILL: 'backend', GEMINI_TRANSCRIBE_VOCABULARY: 'KVCache,KV cache,key-value cache' };
  assert.deepEqual(legacyVocabularyUpdates(original), {});
  assert.ok(getSkillVocabulary('backend', original).includes('MVCC'));
  for (const value of ['MyFramework,MyDatabase', '']) {
    const env = { ACTIVE_SKILL: 'backend', GEMINI_TRANSCRIBE_VOCABULARY: value };
    assert.deepEqual(getSkillVocabulary('backend', env), parseVocabulary(value));
    assert.ok(getSkillVocabulary('devops', env).includes('Terraform'));
    Object.assign(env, legacyVocabularyUpdates(env));
    env.ACTIVE_SKILL = 'devops';
    assert.deepEqual(getSkillVocabulary('backend', env), parseVocabulary(value));
    assert.deepEqual(legacyVocabularyUpdates(env), {});
    assert.ok(getSkillVocabulary('devops', env).includes('Terraform'));
  }
});
