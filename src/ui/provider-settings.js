(function (root) {
  const fields = [
    ['gemini', 'geminiKey', 'Gemini API Key', 'password', ''],
    ['openai', 'openaiKey', 'OpenAI API Key', 'password', ''],
    ['openai', 'openaiBaseUrl', 'OpenAI-compatible base URL', 'url', 'https://api.openai.com/v1'],
    ['openai', 'openaiModel', 'OpenAI model', 'text', 'gpt-4o-mini'],
    ['cloudflare', 'cloudflareAccountId', 'Cloudflare Account ID', 'text', ''],
    ['cloudflare', 'cloudflareToken', 'Cloudflare API Token', 'password', ''],
    ['cloudflare', 'cloudflareModel', 'Workers AI chat model', 'text', '@cf/meta/llama-3.3-70b-instruct-fp8-fast']
  ];

  class ProviderSettings {
    constructor(container, onChange = () => {}) {
      this.container = container;
      this.onChange = onChange;
      const label = document.createElement('label');
      label.textContent = 'AI provider';
      this.provider = document.createElement('select');
      this.provider.className = 'input-field input';
      for (const [value, text] of [['gemini', 'Google Gemini'], ['gemini-live', 'Gemini-3.8-Live (AI Studio)'], ['openai', 'OpenAI / Compatible API'], ['cloudflare', 'Cloudflare Workers AI']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = text; this.provider.appendChild(option);
      }
      container.append(label, this.provider);
      this.inputs = new Map();
      this.rows = [];
      for (const [provider, key, text, type, value] of fields) {
        const row = document.createElement('div'); row.className = 'field settings-stack'; row.style.marginTop = '12px';
        const title = document.createElement('label'); title.textContent = text; title.htmlFor = `ai-${key}`;
        const input = document.createElement('input'); input.id = `ai-${key}`; input.type = type;
        input.className = 'input-field input'; input.value = value; input.style.width = '100%'; input.style.maxWidth = '100%';
        input.autocomplete = 'off'; input.spellcheck = false;
        row.append(title, input); container.appendChild(row);
        this.inputs.set(key, input); this.rows.push({ provider, row });
        input.addEventListener('change', () => this.onChange());
      }
      const note = document.createElement('p'); note.className = 'hint settings-note';
      note.textContent = 'Choose the speech provider independently of the answer model. With Gemini-3.8-Live, its own audio input is available alongside Whisper, Azure, Cloudflare and Transcribe Live. Live answers appear as text without audio playback. Keys are stored locally.';
      container.appendChild(note);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = 'Test AI connection';
      this.status = document.createElement('p'); this.status.className = 'hint settings-note'; this.status.setAttribute('role', 'status');
      container.append(button, this.status);
      button.addEventListener('click', async () => {
        button.disabled = true; this.status.textContent = 'Testing…';
        try {
          const saved = await root.electronAPI.saveSettings(this.values());
          if (!saved.success) throw new Error(saved.error);
          const result = await root.electronAPI.testLlmConnection();
          this.status.textContent = result.success ? `Connected: ${result.model || this.provider.value}` : result.error;
        } catch (error) { this.status.textContent = error.message; }
        finally { button.disabled = false; }
      });
      this.provider.addEventListener('change', () => { this.updateVisibility(); this.onChange(); });
      this.updateVisibility();
    }
    values() {
      return { llmProvider: this.provider.value, ...Object.fromEntries([...this.inputs].map(([key, input]) => [key, input.value.trim()])) };
    }
    load(settings) {
      this.provider.value = settings.llmProvider || 'gemini';
      for (const [key, input] of this.inputs) if (settings[key] !== undefined) input.value = settings[key];
      this.updateVisibility();
    }
    setSpeechProvider(provider) { this.speechProvider = provider; this.updateVisibility(); }
    updateVisibility() {
      for (const item of this.rows) item.row.hidden = item.provider !== this.provider.value &&
        !(item.provider === 'gemini' && (this.provider.value === 'gemini-live' || this.speechProvider === 'gemini-live')) &&
        !(item.provider === 'cloudflare' && this.speechProvider === 'cloudflare');
    }
    isConfigured() {
      const settings = this.values();
      const key = ['gemini', 'gemini-live'].includes(settings.llmProvider) ? settings.geminiKey : settings.llmProvider === 'openai' ? settings.openaiKey : settings.cloudflareToken;
      return Boolean(key && !/^your[_-]|^placeholder/i.test(key) &&
        (settings.llmProvider !== 'cloudflare' || /^[a-f0-9]{32}$/i.test(settings.cloudflareAccountId)));
    }
  }
  root.ProviderSettings = ProviderSettings;
})(window);
