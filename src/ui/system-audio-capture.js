(function (root) {
  class SystemAudioCapture {
    constructor({ mediaDevices, AudioContext, onChunk, onEnded, platform, deviceLabel = '' }) {
      Object.assign(this, { mediaDevices, AudioContext, onChunk, onEnded, platform, deviceLabel });
      this.generation = 0;
    }

    async start() {
      this.stop();
      const generation = this.generation;
      let stream;
      let context;
      try {
        if (this.platform.includes('win')) {
          stream = await this.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } else if (this.platform.includes('mac')) {
          // Electron 29 needs a virtual loopback input on macOS. Require an
          // explicit device label so the default microphone is never selected.
          if (!this.deviceLabel.trim()) throw new Error('macOS requires a loopback device (e.g. BlackHole). Set its name in Settings.');
          const devices = await this.mediaDevices.enumerateDevices();
          const device = devices.find(item => item.kind === 'audioinput' && item.label === this.deviceLabel.trim());
          if (!device) throw new Error('The configured macOS loopback device was not found. Route system output to that device.');
          stream = await this.mediaDevices.getUserMedia({ audio: { deviceId: { exact: device.deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        } else throw new Error('Renderer system audio capture is unavailable on this platform.');

        if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
        if (!stream.getAudioTracks().length) throw new Error('No system audio track was provided. Check output and screen capture permissions.');
        this.stream = stream;
        context = new this.AudioContext({ sampleRate: 16000 });
        this.context = context;
        if (context.sampleRate !== 16000) throw new Error('System audio capture requires a 16000 Hz AudioContext.');
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(4096, 1, 1);
        const mute = context.createGain();
        mute.gain.value = 0; // Keep the graph alive without replaying captured sound.
        Object.assign(this, { source, processor, mute });
        processor.onaudioprocess = event => {
          if (generation !== this.generation) return;
          const input = event.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const value = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = value < 0 ? value * 32768 : value * 32767;
          }
          this.onChunk(pcm.buffer);
        };
        source.connect(processor); processor.connect(mute); mute.connect(context.destination);
        for (const track of stream.getTracks()) track.addEventListener('ended', () => {
          if (generation === this.generation) { this.stop(); this.onEnded('System audio sharing stopped'); }
        }, { once: true });
        await context.resume();
      } catch (error) {
        if (stream && stream !== this.stream) stream.getTracks().forEach(track => track.stop());
        if (generation === this.generation) this.stop();
        throw error;
      }
    }

    stop() {
      this.generation++;
      if (this.processor) { this.processor.onaudioprocess = null; this.processor.disconnect(); }
      if (this.source) this.source.disconnect();
      if (this.mute) this.mute.disconnect();
      if (this.stream) this.stream.getTracks().forEach(track => track.stop());
      if (this.context) this.context.close().catch(() => {});
      this.processor = this.source = this.mute = this.stream = this.context = null;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = SystemAudioCapture;
  else root.SystemAudioCapture = SystemAudioCapture;
})(typeof window !== 'undefined' ? window : globalThis);
