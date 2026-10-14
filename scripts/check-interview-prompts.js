// Only fixed, synthetic questions; never reads or uploads conversation history.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getAISettings } = require('../src/core/ai-settings');
const { configureNetworkSession } = require('../src/core/network-session');
const { promptLoader } = require('../prompt-loader');
const { complete } = require('../src/services/openai-compatible.service');
const file = process.argv[2] || path.join(process.env.APPDATA || '', 'opencluely', '.env');
const settings = getAISettings(dotenv.parse(fs.readFileSync(file)));
if (!['cloudflare', 'openai'].includes(settings.provider) || !settings.configured) throw new Error('Configure OpenAI or Cloudflare before running this manual prompt check');

async function run(electron) {
  try {
    const questions = [
      { skill: 'backend', text: 'Что такое идемпотентность и зачем она нужна в API?' },
      { skill: 'backend', text: 'Расскажи, как ты внедрял кеширование Redis на предыдущем месте работы.' },
      { skill: 'dsa', text: 'Почему поиск в хеш-таблице обычно O(1), но в худшем случае O(n)? Без кода.' }
    ];
    for (const question of questions) {
      const answer = await complete({
        systemInstruction: { parts: [{ text: promptLoader.getSkillPrompt(question.skill, 'go') }] },
        contents: [{ role: 'user', parts: [{ text: question.text }] }],
        generationConfig: { maxOutputTokens: 1024 }
      }, undefined, settings);
      console.log(JSON.stringify({ skill: question.skill, question: question.text, answer }));
    }
    if (electron) electron.app.exit(0);
  } catch (error) {
    const message = String(error.message).split(settings.apiKey).join('[redacted]').split(settings.accountId || '[unused]').join('[account]');
    console.error(JSON.stringify({ error: message, code: error.code }));
    if (electron) electron.app.exit(1); else process.exitCode = 1;
  }
}

if (process.versions.electron) {
  const electron = require('electron');
  electron.app.whenReady().then(() => { configureNetworkSession(electron.session.defaultSession); return run(electron); });
} else run();
