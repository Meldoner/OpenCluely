(function (root) {
  class GeminiTranscribeSettings {
    constructor(container, onChange = () => {}, { global = false } = {}) {
      this.onChange = onChange;
      this.global = global;
      this.selectionOrder = [];
      this.inputs = new Map();
      const group = document.createElement('fieldset');
      group.style.cssText = 'border:1px solid var(--border, #444);border-radius:8px;padding:12px;min-width:0';
      const legend = document.createElement('legend');
      legend.textContent = global ? 'Dialogue languages' : 'Transcribe Live languages';
      let content = group;
      if (global) {
        content = document.createElement('details'); content.className = 'settings-advanced';
        this.toggle = document.createElement('summary'); this.toggle.className = 'btn';
        content.appendChild(this.toggle); group.append(legend, content);
      } else group.appendChild(legend);
      const search = document.createElement('input'); search.type = 'search';
      search.className = 'input-field input'; search.placeholder = 'Find a language'; search.setAttribute('aria-label', global ? 'Find a dialogue language' : 'Find a transcription language');
      search.style.cssText = 'width:100%;max-width:100%;margin-bottom:12px';
      const list = document.createElement('div');
      list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;max-height:180px;overflow:auto';
      for (const [code, name] of root.GeminiTranscribeLanguages.LANGUAGES) {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer';
        const input = document.createElement('input');
        input.type = 'checkbox'; input.value = code; input.style.cssText = 'width:auto;margin:0;flex:none';
        label.append(input, document.createTextNode(`${name} (${code})`));
        list.appendChild(label); this.inputs.set(code, input);
        input.addEventListener('change', () => {
          this.selectionOrder = this.selectionOrder.filter(value => value !== code);
          if (input.checked) this.selectionOrder.push(code);
          this.updateSummary(); this.onChange();
        });
      }
      this.summary = document.createElement('p');
      search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        for (const label of list.children) label.style.display = label.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
      });
      this.summary.className = 'hint settings-note'; this.summary.setAttribute('role', 'status');
      const note = document.createElement('p'); note.className = 'hint settings-note';
      note.textContent = 'Choose any combination of languages. These are recognition hints, not language restrictions. No selection means automatic detection.';
      if (global) note.textContent = 'Applies to answers and speech recognition with every model. With several languages, answers follow the question when possible; otherwise they use the first selected language. Whisper auto-detects when several languages are selected or a language is unsupported. Standard Cloudflare Whisper always auto-detects. Azure uses the first selected language (English if none). Transcribe Live uses all selections as recognition hints. No selection lets answers follow the question.';
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Auto-detect';
      reset.addEventListener('click', () => { this.load([]); this.onChange(); });
      content.append(search, list, this.summary, reset, note); container.appendChild(group);
      this.updateSummary();
    }
    values() { return this.global ? [...this.selectionOrder] : [...this.inputs].filter(([, input]) => input.checked).map(([code]) => code); }
    load(value = []) {
      const selected = new Set(root.GeminiTranscribeLanguages.parse(value));
      this.selectionOrder = [...selected];
      for (const [code, input] of this.inputs) input.checked = selected.has(code);
      this.updateSummary();
    }
    updateSummary() {
      const codes = this.values();
      this.summary.textContent = codes.length ? `Selected: ${codes.join(', ')}` : 'Automatic language detection';
      if (this.toggle) this.toggle.textContent = codes.length ? codes.join(', ') : 'Auto-detect';
    }
  }
  root.GeminiTranscribeSettings = GeminiTranscribeSettings;
})(window);
