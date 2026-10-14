(function (root) {
  class GeminiTranscribeSettings {
    constructor(container, onChange = () => {}) {
      this.onChange = onChange;
      this.inputs = new Map();
      const group = document.createElement('fieldset');
      group.style.cssText = 'border:1px solid var(--border, #444);border-radius:8px;padding:12px;min-width:0';
      const legend = document.createElement('legend');
      legend.textContent = 'Transcribe Live languages';
      const search = document.createElement('input'); search.type = 'search';
      search.className = 'input-field input'; search.placeholder = 'Find a language'; search.setAttribute('aria-label', 'Find a transcription language');
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
        input.addEventListener('change', () => { this.updateSummary(); this.onChange(); });
      }
      this.summary = document.createElement('p');
      search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        for (const label of list.children) label.style.display = label.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
      });
      this.summary.className = 'hint settings-note'; this.summary.setAttribute('role', 'status');
      const note = document.createElement('p'); note.className = 'hint settings-note';
      note.textContent = 'Choose any combination of languages. These are recognition hints, not language restrictions. No selection means automatic detection.';
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Auto-detect';
      reset.addEventListener('click', () => { this.load([]); this.onChange(); });
      group.append(legend, search, list, this.summary, reset, note); container.appendChild(group);
      this.updateSummary();
    }
    values() { return [...this.inputs].filter(([, input]) => input.checked).map(([code]) => code); }
    load(value = []) {
      const selected = new Set(root.GeminiTranscribeLanguages.parse(value));
      for (const [code, input] of this.inputs) input.checked = selected.has(code);
      this.updateSummary();
    }
    updateSummary() {
      const codes = this.values();
      this.summary.textContent = codes.length ? `Selected: ${codes.join(', ')}` : 'Automatic language detection';
    }
  }
  root.GeminiTranscribeSettings = GeminiTranscribeSettings;
})(window);
