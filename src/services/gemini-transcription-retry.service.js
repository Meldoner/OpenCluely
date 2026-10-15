const { EventEmitter } = require('events');
const { isRetryableSpeechError, waitForSpeechRetry } = require('../core/speech-retry');
const { removeTranscriptOverlap } = require('../core/transcript-overlap');

// Reconnect only the transcription stream. Replaying an answer-generating
// Live session could generate the same answer twice.
class GeminiTranscriptionRetry extends EventEmitter {
  constructor(createSession, options = {}) {
    super();
    this.createSession = createSession;
    this.options = options;
    this.abortController = new AbortController();
    this.pending = [];
    this.pendingBytes = 0;
    this.retryCount = 0;
    this.ready = false;
    this.closed = false;
    this.previousTranscript = '';
  }

  connect() {
    this.recovery = this._connect();
    return this.recovery;
  }

  async _connect(error = null) {
    while (!this.closed) {
      try {
        if (error) {
          if (!isRetryableSpeechError(error) || this.retryCount >= 2) throw error;
          this.retryCount++;
          this.emit('retry', this.retryCount);
          await waitForSpeechRetry(this.retryCount, this.abortController.signal, this.options.retryDelayMs);
        }
        this.connecting = true;
        this.connectionError = null;
        const session = this.createSession();
        this.session = session;
        session.on('content', content => this._receive(session, content));
        session.on('closed', failure => {
          if (this.closed || this.session !== session) return;
          this.ready = false;
          this.connectionError = failure;
          if (!this.connecting && !this.recovering) {
            this.recovering = true;
            this.recovery = this._connect(failure);
            this.recovery.catch(reason => this.fail(reason));
          }
        });
        await session.connect();
        if (this.closed) throw this.abortController.signal.reason;
        this.connecting = false;
        this.ready = true;
        if (this.manualStarted) session.send({ realtimeInput: { activityStart: {} } });
        if (this.recovering) {
          this.replay = [...this.pending];
          for (const entry of this.replay) entry.sent = false;
          this.trimReplayedText = true;
          while (this.replay.length) {
            if (this.connectionError) throw this.connectionError;
            const entry = this.replay.shift();
            session.sendAudio(entry.buffer);
            entry.sent = true;
            // Replay at twice real time; leave room for incoming live audio.
            await waitForSpeechRetry(1, this.abortController.signal,
              this.options.replayDelayMs ?? Math.max(1, entry.buffer.length / 64));
          }
          if (this.connectionError) throw this.connectionError;
          this.recovering = false;
          this.emit('reconnected');
        }
        return this;
      } catch (failure) {
        this.connecting = false;
        const old = this.session;
        this.session = null;
        old?.close();
        this.ready = false;
        if (this.closed || !isRetryableSpeechError(failure) || this.retryCount >= 2) throw failure;
        error = failure;
      }
    }
    throw this.abortController.signal.reason;
  }

  _receive(session, content) {
    if (this.closed || this.session !== session) return;
    const raw = content.inputTranscription?.text?.trim();
    if (raw) {
      const text = this.trimReplayedText ? removeTranscriptOverlap(this.previousTranscript, raw) : raw;
      this.trimReplayedText = false;
      this.previousTranscript = raw;
      // Live Transcribe acknowledges utterances, not PCM offsets. Keep a short
      // sent tail to cover the next word already in flight, plus all unsent data.
      const sent = this.pending.filter(entry => entry.sent).map(entry => entry.buffer);
      const tail = sent.length ? Buffer.concat(sent).subarray(-16000) : null;
      this.pending = this.pending.filter(entry => !entry.sent);
      if (tail?.length) this.pending.unshift({ buffer: tail, sent: true });
      this.pendingBytes = this.pending.reduce((total, entry) => total + entry.buffer.length, 0);
      this.unconfirmedSpeech = this.pending.some(entry => !entry.sent && this._hasSignal(entry.buffer));
      this.emit('content', { ...content, inputTranscription: { ...content.inputTranscription, text } });
    } else this.emit('content', content);
  }

  send(message) {
    if (message.realtimeInput?.activityStart) this.manualStarted = true;
    this.session.send(message);
  }

  sendAudio(buffer) {
    if (this.closed) return;
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length % 2) throw new Error('Expected mono PCM16 audio');
    const entry = { buffer: Buffer.from(buffer), sent: false };
    this.pending.push(entry);
    this.pendingBytes += buffer.length;
    this.unconfirmedSpeech ||= this._hasSignal(buffer);
    // A quiet desktop may legitimately produce no transcript for minutes.
    // Keep pre-roll for recovery without treating silence as a stalled server.
    if (!this.unconfirmedSpeech && this.pendingBytes > 32000) {
      const tail = Buffer.concat(this.pending.map(item => item.buffer)).subarray(-16000);
      this.pending = [{ buffer: tail, sent: true }];
      this.pendingBytes = tail.length;
    }
    if (this.pendingBytes > 60000 * 32) {
      this.fail(new Error('Live transcription has not confirmed audio for 60 seconds. Recording stopped to limit the backlog.'));
      return;
    }
    if (this.recovering) this.replay?.push(entry);
    else if (this.ready) { this.session.sendAudio(entry.buffer); entry.sent = true; }
  }

  _hasSignal(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 2) sum += (buffer.readInt16LE(i) / 32768) ** 2;
    return Math.sqrt(sum / (buffer.length / 2)) >= 0.0005;
  }

  async finish(options) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.recovery;
      const session = this.session;
      try { return await session.finish(options); }
      catch (error) {
        if (this.closed || !isRetryableSpeechError(error) || !this.recovering) throw error;
      }
    }
    throw new Error('Live transcription could not finalize after reconnecting');
  }

  fail(error) { this.close(error); }

  close(error = new Error('Live session cancelled')) {
    if (this.closed) return;
    this.closed = true;
    this.ready = false;
    this.abortController.abort(error);
    this.session?.close(error);
    this.pending = [];
    this.pendingBytes = 0;
    this.replay = [];
    this.emit('closed', error);
    this.removeAllListeners();
  }
}

module.exports = GeminiTranscriptionRetry;
