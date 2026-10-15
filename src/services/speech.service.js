// Enhanced polyfills for Azure Speech SDK in Node.js environment
if (typeof window === 'undefined') {
  global.window = {
    navigator: {
      userAgent: 'Node.js',
      platform: 'node',
      mediaDevices: {
        getUserMedia: () => Promise.resolve({
          getAudioTracks: () => [],
          getTracks: () => [],
          stop: () => {}
        }),
        getSupportedConstraints: () => ({
          audio: true,
          video: false,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: true,
          sampleSize: true,
          channelCount: true
        }),
        enumerateDevices: () => Promise.resolve([
          {
            deviceId: 'default',
            kind: 'audioinput',
            label: 'Default - Microphone',
            groupId: 'default'
          }
        ])
      }
    },
    document: {
      createElement: (tagName) => {
        const element = {
          addEventListener: () => {},
          removeEventListener: () => {},
          setAttribute: () => {},
          getAttribute: () => null,
          style: {},
          tagName: tagName.toUpperCase(),
          nodeType: 1,
          nodeName: tagName.toUpperCase(),
          appendChild: () => {},
          removeChild: () => {},
          insertBefore: () => {},
          cloneNode: () => element,
          hasAttribute: () => false,
          removeAttribute: () => {},
          click: () => {},
          focus: () => {},
          blur: () => {}
        };

        if (tagName.toLowerCase() === 'audio') {
          Object.assign(element, {
            play: () => Promise.resolve(),
            pause: () => {},
            load: () => {},
            canPlayType: () => 'probably',
            volume: 1,
            muted: false,
            paused: true,
            ended: false,
            currentTime: 0,
            duration: 0,
            playbackRate: 1,
            defaultPlaybackRate: 1,
            readyState: 4,
            networkState: 1,
            autoplay: false,
            loop: false,
            controls: false,
            crossOrigin: null,
            preload: 'metadata',
            src: '',
            currentSrc: ''
          });
        }

        return element;
      },
      getElementById: () => null,
      getElementsByTagName: () => [],
      getElementsByClassName: () => [],
      querySelector: () => null,
      querySelectorAll: () => [],
      body: {
        appendChild: () => {},
        removeChild: () => {},
        insertBefore: () => {},
        style: {}
      },
      head: {
        appendChild: () => {},
        removeChild: () => {},
        insertBefore: () => {},
        style: {}
      }
    },
    location: {
      href: 'file:///',
      protocol: 'file:',
      host: '',
      hostname: '',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
      origin: 'file://'
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    requestAnimationFrame: (callback) => global.setTimeout(callback, 16),
    cancelAnimationFrame: global.clearTimeout,
    console: global.console || {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {}
    },
    AudioContext: class AudioContext {
      constructor() {
        this.state = 'running';
        this.sampleRate = 16000;
        this.currentTime = 0;
        this.listener = {
          setPosition: () => {},
          setOrientation: () => {}
        };
        this.destination = {
          connect: () => {},
          disconnect: () => {},
          channelCount: 2,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        };
      }
      createMediaStreamSource(stream) {
        return {
          connect: () => {},
          disconnect: () => {},
          mediaStream: stream
        };
      }
      createGain() {
        return {
          connect: () => {},
          disconnect: () => {},
          gain: {
            value: 1,
            setValueAtTime: () => {},
            linearRampToValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {}
          }
        };
      }
      createScriptProcessor(bufferSize = 4096, inputChannels = 1, outputChannels = 1) {
        return {
          connect: () => {},
          disconnect: () => {},
          onaudioprocess: null,
          bufferSize,
          numberOfInputs: inputChannels,
          numberOfOutputs: outputChannels
        };
      }
      createAnalyser() {
        return {
          connect: () => {},
          disconnect: () => {},
          fftSize: 2048,
          frequencyBinCount: 1024,
          minDecibels: -100,
          maxDecibels: -30,
          smoothingTimeConstant: 0.8,
          getByteFrequencyData: () => {},
          getByteTimeDomainData: () => {},
          getFloatFrequencyData: () => {},
          getFloatTimeDomainData: () => {}
        };
      }
      decodeAudioData() {
        return Promise.resolve({
          length: 44100,
          sampleRate: 44100,
          numberOfChannels: 1,
          duration: 1,
          getChannelData: () => new Float32Array(44100)
        });
      }
      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    },
    webkitAudioContext: class webkitAudioContext {
      constructor() {
        this.state = 'running';
        this.sampleRate = 16000;
        this.currentTime = 0;
        this.listener = {
          setPosition: () => {},
          setOrientation: () => {}
        };
        this.destination = {
          connect: () => {},
          disconnect: () => {},
          channelCount: 2,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        };
      }
      createMediaStreamSource(stream) {
        return {
          connect: () => {},
          disconnect: () => {},
          mediaStream: stream
        };
      }
      createGain() {
        return {
          connect: () => {},
          disconnect: () => {},
          gain: {
            value: 1,
            setValueAtTime: () => {},
            linearRampToValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {}
          }
        };
      }
      createScriptProcessor(bufferSize = 4096, inputChannels = 1, outputChannels = 1) {
        return {
          connect: () => {},
          disconnect: () => {},
          onaudioprocess: null,
          bufferSize,
          numberOfInputs: inputChannels,
          numberOfOutputs: outputChannels
        };
      }
      createAnalyser() {
        return {
          connect: () => {},
          disconnect: () => {},
          fftSize: 2048,
          frequencyBinCount: 1024,
          minDecibels: -100,
          maxDecibels: -30,
          smoothingTimeConstant: 0.8,
          getByteFrequencyData: () => {},
          getByteTimeDomainData: () => {},
          getFloatFrequencyData: () => {},
          getFloatTimeDomainData: () => {}
        };
      }
      decodeAudioData() {
        return Promise.resolve({
          length: 44100,
          sampleRate: 44100,
          numberOfChannels: 1,
          duration: 1,
          getChannelData: () => new Float32Array(44100)
        });
      }
      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    },
    URL: class URL {
      constructor(url) {
        this.href = url;
        this.protocol = 'https:';
        this.host = 'localhost';
        this.hostname = 'localhost';
        this.port = '';
        this.pathname = '/';
        this.search = '';
        this.hash = '';
        this.origin = 'https://localhost';
      }
      toString() {
        return this.href;
      }
    },
    Blob: class Blob {
      constructor(parts = [], options = {}) {
        this.size = 0;
        this.type = options.type || '';
        this.parts = parts;
      }
      slice() {
        return new Blob();
      }
      stream() {
        return new ReadableStream();
      }
      text() {
        return Promise.resolve('');
      }
      arrayBuffer() {
        return Promise.resolve(new ArrayBuffer(0));
      }
    },
    File: class File {
      constructor(parts, name, options = {}) {
        this.name = name;
        this.size = 0;
        this.type = options.type || '';
        this.lastModified = Date.now();
        this.parts = parts;
      }
      slice() {
        return new File([], this.name);
      }
      stream() {
        return new ReadableStream();
      }
      text() {
        return Promise.resolve('');
      }
      arrayBuffer() {
        return Promise.resolve(new ArrayBuffer(0));
      }
    }
  };
  global.document = global.window.document;
  global.navigator = global.window.navigator;
  global.AudioContext = global.window.AudioContext;
  global.webkitAudioContext = global.window.webkitAudioContext;
  global.URL = global.window.URL;
  global.Blob = global.window.Blob;
  global.File = global.window.File;

  if (!global.performance) {
    global.performance = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      clearMarks: () => {},
      clearMeasures: () => {},
      getEntriesByName: () => [],
      getEntriesByType: () => []
    };
  }

  if (!global.crypto) {
    global.crypto = {
      getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }
    };
  }
}

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const logger = require('../core/logger').createServiceLogger('SPEECH');
const config = require('../core/config');
const WhisperWorkerService = require('./whisper-worker.service');
const cloudflareSpeech = require('./cloudflare-speech.service');
const { startNativeCapture } = require('./system-audio.service');

let sdk = null;
try {
  sdk = require('microsoft-cognitiveservices-speech-sdk');
} catch (error) {
  logger.warn('Azure Speech SDK unavailable', { error: error.message });
}

class SpeechService extends EventEmitter {
  constructor() {
    super();
    this.recognizer = null;
    this.isRecording = false;
    this.audioConfig = null;
    this.speechConfig = null;
    this.sessionStartTime = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.pushStream = null;
    this.recording = null;
    this.available = false;
    this.provider = 'disabled';
    this.runtimeSettings = {};
    this.segmentBuffers = [];
    this.segmentBytes = 0;
    this.segmentTimer = null;
    this.transcriptionInFlight = false;
    this.audioProgram = null;
    this.whisperCommand = null;
    this.whisperWorker = new WhisperWorkerService();
    this.isProcessingAudio = false;
    this.manualStopRequested = false;
    this._resetVadState();

    this.initializeClient();
  }

  initializeClient() {
    this._cleanup();
    this.provider = 'disabled';
    this.available = false;
    this.speechConfig = null;
    this.whisperCommand = null;

    const provider = this._getConfiguredProvider();
    this.provider = provider;

    if (provider === 'azure') {
      this._initializeAzureClient();
      return;
    }

    if (provider === 'whisper') {
      this._initializeWhisperClient();
      return;
    }

    if (provider === 'cloudflare') {
      this.available = cloudflareSpeech.isConfigured();
      this.emit('status', this.available ? 'Cloudflare Whisper ready' : 'Configure Cloudflare Account ID and API Token');
      return;
    }

    if (this._isGeminiLiveProvider()) {
      const nativeMismatch = provider === 'gemini-live-audio' && process.env.LLM_PROVIDER !== 'gemini-live';
      this.available = require('../core/ai-settings').isConfiguredKey(process.env.GEMINI_API_KEY) &&
        !nativeMismatch;
      this.emit('status', nativeMismatch ? 'Select Gemini-3.8-Live in AI Providers to use its audio input' :
        this.available ? `${this.usesLiveAudioAnswers() ? 'Gemini-3.8-Live audio' : 'Gemini-3.5-Transcribe Live'} ready` : 'Configure the Gemini API key in AI Providers');
      return;
    }

    const reason = 'Speech recognition disabled. Configure local Whisper, Cloudflare Whisper or Azure.';
    logger.warn(reason);
    this.emit('status', reason);
  }

  _initializeAzureClient() {
    try {
      if (!sdk) {
        throw new Error('Azure Speech SDK dependency is not installed');
      }

      const subscriptionKey = this._getSetting('azureKey') || process.env.AZURE_SPEECH_KEY;
      const region = this._getSetting('azureRegion') || process.env.AZURE_SPEECH_REGION;

      if (!subscriptionKey || !region) {
        const reason = 'Azure Speech credentials not found. Speech recognition disabled.';
        logger.warn('Speech service disabled (missing Azure credentials)');
        this.emit('status', reason);
        return;
      }

      this.speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, region);

      const azureConfig = config.get('speech.azure') || {};
      this.speechConfig.speechRecognitionLanguage = this._getDialogueLanguages()[0] || azureConfig.language || 'en-US';
      this.speechConfig.outputFormat = sdk.OutputFormat.Detailed;
      this.speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '5000');
      this.speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, '2000');
      this.speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, '2000');

      if (azureConfig.enableDictation) {
        this.speechConfig.enableDictation();
      }

      if (azureConfig.enableAudioLogging) {
        this.speechConfig.enableAudioLogging();
      }

      this.available = true;
      logger.info('Azure Speech service initialized successfully', {
        region,
        language: this.speechConfig.speechRecognitionLanguage
      });
      this.emit('status', 'Azure Speech Services ready');
    } catch (error) {
      logger.error('Failed to initialize Azure Speech client', {
        error: error.message,
        stack: error.stack
      });
      this.available = false;
      this.emit('status', 'Azure speech unavailable');
    }
  }

  _initializeWhisperClient() {
    try {
      this.whisperCommand = this._resolveWhisperCommand();
      if (!this.whisperCommand) {
        const reason = 'Local Whisper unavailable. Install the Whisper CLI or set WHISPER_COMMAND.';
        logger.warn(reason);
        this.emit('status', reason);
        return;
      }

      this.available = true;
      this._configureWhisperWorker();
      logger.info('Local Whisper service initialized successfully', {
        command: [this.whisperCommand.command, ...this.whisperCommand.baseArgs].join(' '),
        model: this._getWhisperModel(),
        language: this._getWhisperLanguage()
      });
      this.emit('status', 'Local Whisper ready');
    } catch (error) {
      logger.error('Failed to initialize local Whisper client', {
        error: error.message,
        stack: error.stack
      });
      this.available = false;
      this.emit('status', 'Local Whisper unavailable');
    }
  }

  startRecording() {
    try {
      if (!this.available) {
        const errorMsg = `Speech provider "${this.provider}" is not available`;
        logger.error(errorMsg);
        this.emit('error', errorMsg);
        return;
      }

      if (this.isRecording) {
        logger.warn('Recording already in progress');
        return;
      }

      if (this.isProcessingAudio) {
        this.emit('status', 'Please wait for the current transcription to finish');
        return;
      }

      this.sessionStartTime = Date.now();
      this.retryCount = 0;

      if (this.provider === 'azure') {
        this._startAzureRecording();
        return;
      }

      if (this._isGeminiLiveProvider()) {
        this._startGeminiLiveRecording();
        return;
      }

      if (this._isWhisperProvider()) {
        this._startWhisperRecording();
        return;
      }

      throw new Error(`Unsupported speech provider: ${this.provider}`);
    } catch (error) {
      logger.error('Critical error in startRecording', { error: error.message, stack: error.stack });
      this.emit('error', `Speech recognition failed to start: ${error.message}`);
      this.isRecording = false;
    }
  }

  _startAzureRecording() {
    if (!this.speechConfig) {
      throw new Error('Azure Speech client not initialized');
    }

    this._cleanup();
    this.isRecording = true;

    try {
      this.pushStream = sdk.AudioInputStream.createPushStream();
      this.audioConfig = sdk.AudioConfig.fromStreamInput(this.pushStream);
      this.recognizer = new sdk.SpeechRecognizer(this.speechConfig, this.audioConfig);
      this._startSystemAudioCapture();
      this.emit('status', 'Azure system audio recording started');
    } catch (error) {
      logger.error('Failed to start Azure recording session', { error: error.message });
      this.emit('error', `Audio configuration failed: ${error.message}`);
      this.isRecording = false;
      this._finalizeStop('Recording stopped');
      return;
    }

    this.recognizer.recognizing = (s, e) => {
      try {
        if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
          this.emit('interim-transcription', e.result.text);
        }
      } catch (error) {
        logger.error('Error in recognizing handler', { error: error.message });
      }
    };

    this.recognizer.recognized = (s, e) => {
      try {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text && e.result.text.trim()) {
          this.emit('transcription', e.result.text);
        }
      } catch (error) {
        logger.error('Error in recognized handler', { error: error.message });
      }
    };

    this.recognizer.canceled = (s, e) => {
      logger.warn('Recognition session canceled', {
        reason: e.reason,
        errorCode: e.errorCode,
        errorDetails: e.errorDetails
      });

      if (e.reason === sdk.CancellationReason.Error) {
        const details = e.errorDetails || '';
        if (details.includes('1006')) {
          this.emit('error', 'Network connection failed. Please check your internet connection.');
        } else if (details.includes('InvalidServiceCredentials')) {
          this.emit('error', 'Invalid Azure Speech credentials. Please check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
        } else if (details.includes('Forbidden')) {
          this.emit('error', 'Access denied. Please check your Azure Speech service subscription and region.');
        } else if (details.includes('AudioInputMicrophone_InitializationFailure')) {
          this.emit('error', 'System audio initialization failed. Check output capture and permissions.');
        } else {
          this.emit('error', `Recognition error: ${details}`);
        }
      }

      this.stopRecording();
    };

    this.recognizer.sessionStarted = (s, e) => {
      logger.info('Recognition session started', { sessionId: e.sessionId });
    };

    this.recognizer.sessionStopped = () => {
      this.stopRecording();
    };

    const startTimeout = setTimeout(() => {
      logger.error('Recognition start timeout');
      this.emit('error', 'Speech recognition start timeout. Please try again.');
      this.stopRecording();
    }, 10000);

    this.recognizer.startContinuousRecognitionAsync(
      () => {
        clearTimeout(startTimeout);
        logger.info('Continuous Azure speech recognition started successfully');
      },
      (error) => {
        clearTimeout(startTimeout);
        logger.error('Failed to start continuous recognition', { error: error.toString() });
        this.emit('error', `Recognition startup failed: ${error}`);
        this.isRecording = false;
        this._finalizeStop('Recording stopped');
      }
    );
  }

  _startWhisperRecording() {
    this._cleanup();
    this.isRecording = true;
    this.segmentBuffers = [];
    this.segmentBytes = 0;
    this.transcriptionInFlight = false;
    this.manualStopRequested = false;
    this._resetVadState();
    this.emit('status', `${this.provider === 'cloudflare' ? 'Cloudflare' : 'Local'} Whisper system audio recording started`);

    if (this.provider === 'whisper' && this.whisperWorker.isConfigured()) {
      this.whisperWorker.warmup({
        model: this._getWhisperModel(),
        modelDir: this._getWhisperModelDir(),
        device: this._getWhisperDevice()
      }).then((result) => {
        logger.info('Whisper GPU warmup completed while recording', {
          model: result.model,
          device: result.device,
          gpu: result.gpu
        });
      }).catch((error) => {
        logger.warn('Whisper warmup failed; transcription will use fallback', {
          error: error.message
        });
      });
    }

    this._startSystemAudioCapture();
    if (!this._isManualCaptureMode()) {
      this._startSegmentWatchdog();
    }

  }

  async _startGeminiLiveRecording() {
    this._cleanup();
    this.isRecording = true;
    this.liveHadSpeech = false;
    this.liveAudioBytes = 0;
    this.liveFinalTranscripts = [];
    const manual = this.isManualCaptureMode();
    const audioAnswers = this.usesLiveAudioAnswers();
    const liveAPI = require('./gemini-live.service');
    let live;
    try {
      live = audioAnswers
        ? liveAPI.createAudioConversation(this.getLiveAudioRequest(), { manual })
        : liveAPI.createRecoveringTranscription({ manual, languageCodes: this._getGeminiTranscribeLanguages(), customVocabulary: this._getGeminiTranscribeVocabulary() });
    } catch (error) { this._abortGeminiLive(error); return; }
    this.liveSession = live;
    live.on('retry', attempt => this.emit('status', `Live connection interrupted; reconnecting (${attempt}/2)…`));
    live.on('reconnected', () => this.emit('status', 'Live connection restored'));
    if (audioAnswers) {
      live.on('transcription', text => {
        if (this.liveSession !== live) return;
        this.liveHadSpeech = false;
        this.emit('live-transcription', text);
        this.emit('interim-transcription', '');
      });
      live.on('interim-transcription', text => { if (this.liveSession === live) this.emit('interim-transcription', text); });
      for (const event of ['response-start', 'response-chunk', 'response-complete', 'response-error']) {
        live.on(event, data => { if (this.liveSession === live) this.emit(`live-${event}`, data); });
      }
    } else live.on('content', content => {
      if (this.liveSession !== live) return;
      if (content.interimInputTranscription?.text) this.emit('interim-transcription', content.interimInputTranscription.text);
      if (content.inputTranscription?.text) {
        const text = content.inputTranscription.text.trim();
        this.liveHadSpeech = false;
        if (text) {
          if (manual) this.liveFinalTranscripts.push(text);
          else this.emit('transcription', text);
        }
        this.emit('interim-transcription', '');
      }
    });
    live.on('closed', error => {
      if (this.liveSession === live) this._abortGeminiLive(error);
    });
    this.emit('status', 'Connecting to Gemini Live…');
    try {
      await live.connect();
      if (this.liveSession !== live || !this.isRecording) return;
      if (manual) live.send({ realtimeInput: { activityStart: {} } });
      this._startSystemAudioCapture();
      if (this.liveSession !== live || !this.isRecording) return;
      this.emit('status', 'Gemini Live system audio recording started');
      // Close before the documented ten-minute transcription session limit.
      this.liveLimitTimer = setTimeout(() => this.stopRecording(), 590000);
    } catch (error) {
      if (this.liveSession === live) this._abortGeminiLive(error);
    }
  }

  _abortGeminiLive(error) {
    if (this.liveSession && !this.liveSession.closed) { this.liveSession.fail(error); return; }
    const wasRecording = this.isRecording;
    this.isRecording = false;
    this.isProcessingAudio = false;
    this._cleanup();
    if (wasRecording) this.emit('recording-stopped');
    this.emit('error', error.message);
    this.emit('status', 'Gemini Live recording stopped');
  }

  async _stopGeminiLiveRecording() {
    const live = this.liveSession;
    this.isProcessingAudio = true;
    this.emit('recording-stopped');
    this.useRendererCapture = false;
    this.emit('status', 'Finishing Live transcription…');
    try {
      if (this.recording) { this.recording.stop(); this.recording = null; }
      if (live?.ready || live?.recovering) {
        await live.finish({ hasSpeech: this.liveHadSpeech });
        if (!this.usesLiveAudioAnswers() && this.liveSession === live && this.isManualCaptureMode() && this.liveFinalTranscripts.length) {
          this.emit('transcription', this.liveFinalTranscripts.join(' '));
        }
      }
    } catch (error) {
      if (this.liveSession === live) live.fail(error);
    } finally {
      if (this.liveSession === live) {
        this._cleanup();
        this.isProcessingAudio = false;
        this.emit('status', 'Recording stopped');
      }
    }
  }

  /**
   * Reset the voice-activity-detection state machine. VAD replaces the old
   * fixed-interval segmentation: instead of cutting audio every N seconds
   * (which split sentences mid-word and transcribed silent windows), we
   * accumulate audio while the user is speaking and flush a segment once a
   * natural pause is detected. State is intentionally simple so it works for
   * both the renderer (Web Audio) and native system-loopback capture paths.
   */
  _resetVadState() {
    this.vadSpeaking = false;        // currently inside an utterance
    this.vadSpeechMs = 0;            // accumulated voiced audio in this segment
    this.vadSilenceMs = 0;           // trailing silence since last voiced chunk
    this.vadNoiseFloor = 0;          // adaptive EMA of background energy
    this.vadNoiseInit = false;       // has the noise floor been seeded
    this.vadPreRoll = [];            // ring of recent pre-speech chunks
    this.vadPreRollMs = 0;           // duration held in the pre-roll ring
    this.vadLastChunkAt = 0;         // timestamp of the last ingested chunk
  }

  _isWhisperProvider() {
    return this.provider === 'whisper' || this.provider === 'cloudflare';
  }

  _startSystemAudioCapture() {
    this.useRendererCapture = process.platform === 'win32' || process.platform === 'darwin';
    if (!this.useRendererCapture) {
      this.recording = startNativeCapture(chunk => this._handleAudioChunk(chunk), error => {
        this.emit('error', error.message);
        this.stopRecording();
      });
    }
    this.emit('recording-started');
  }

  /**
   * Lightweight watchdog. Silence is normally detected from incoming chunks
   * (which keep flowing at low energy), but if the capture pipeline stalls
   * mid-utterance we still want to flush what we have. The watchdog also
   * enforces the max-utterance cap as a backstop.
   */
  _startSegmentWatchdog() {
    if (this.segmentTimer) {
      clearInterval(this.segmentTimer);
    }
    this.segmentTimer = setInterval(() => {
      if (!this.isRecording || !this._isWhisperProvider()) {
        return;
      }

      // VAD disabled (fallback): preserve the legacy fixed-window behaviour by
      // flushing once the accumulated audio reaches the configured segment size.
      if (!this._isVadEnabled()) {
        if (this.segmentBytes && this.vadSpeechMs >= this._getWhisperSegmentMs()) {
          this._endUtteranceFlush({ forced: true });
        }
        return;
      }

      // If we're mid-utterance and no audio has arrived recently, capture may
      // have stalled — flush what we captured rather than holding it forever.
      const sinceLastChunk = this.vadLastChunkAt ? Date.now() - this.vadLastChunkAt : 0;
      const stalled = this.vadSpeaking && sinceLastChunk > 1500;
      const tooLong = this.vadSpeaking && this.segmentBytes / 32 >= this._getMaxUtteranceMs();
      if (stalled || tooLong) {
        if (this.vadSpeechMs >= this._getMinUtteranceMs()) this._endUtteranceFlush({ forced: tooLong && !stalled });
        else this._discardWhisperUtterance();
      }
    }, 500);
  }

  /**
   * Receive raw 16kHz mono 16-bit PCM audio from the renderer and add it to
   * the current Whisper segment buffer.
   */
  handleAudioChunkFromRenderer(chunk) {
    if (!this.isRecording || !this.useRendererCapture) {
      return;
    }
    if (!chunk || !chunk.length) {
      return;
    }
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this._handleAudioChunk(buffer);
  }

  /**
   * Compute the RMS energy (normalized to 0..1) of a 16-bit little-endian PCM
   * buffer. Used as the voice-activity signal.
   */
  _chunkRmsEnergy(buffer) {
    const sampleCount = Math.floor(buffer.length / 2);
    if (sampleCount === 0) {
      return 0;
    }
    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const sample = buffer.readInt16LE(i * 2) / 32768;
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / sampleCount);
  }

  /**
   * Single ingest path for both capture backends. Runs the VAD state machine:
   * accumulate audio while the user speaks, and flush the segment to Whisper
   * once a natural pause (trailing silence) is detected. Falls back to plain
   * buffering when VAD is disabled.
   */
  _ingestWhisperAudio(buffer) {
    if (!buffer || !buffer.length || this.manualStopRequested) {
      return;
    }

    if (this._isManualCaptureMode()) {
      this.segmentBuffers.push(buffer);
      this.segmentBytes += buffer.length;
      this.vadLastChunkAt = Date.now();

      const capturedMs = this.segmentBytes / 32;
      if (!this.manualStopRequested && capturedMs >= this._getManualCaptureMaxMs()) {
        this.manualStopRequested = true;
        this.emit('status', 'Maximum recording duration reached; processing audio');
        setImmediate(() => this.stopRecording());
      }
      return;
    }

    if (!this._isVadEnabled()) {
      // Legacy behaviour: the watchdog/max-utterance cap drives flushing.
      this.segmentBuffers.push(buffer);
      this.segmentBytes += buffer.length;
      this.vadSpeaking = true;
      this.vadSpeechMs += this._chunkDurationMs(buffer);
      this.vadLastChunkAt = Date.now();
      if (this.vadSpeechMs >= this._getWhisperSegmentMs()) this._endUtteranceFlush({ forced: true });
      return;
    }

    // Analyse 20 ms frames even when Web Audio delivers a 256 ms block.
    // Otherwise a short word is averaged with silence and never enters VAD.
    for (let offset = 0; offset < buffer.length; offset += 640) {
      this._ingestWhisperFrame(buffer.subarray(offset, offset + 640));
      if (!this.isRecording) break;
    }
  }

  _ingestWhisperFrame(buffer) {
    this.vadLastChunkAt = Date.now();
    const chunkMs = this._chunkDurationMs(buffer);
    const energy = this._chunkRmsEnergy(buffer);

    const floor = this._getVadEnergyFloor();
    // Seed / adapt the background noise floor while not actively speaking so
    // the threshold tracks the room rather than a hard-coded constant. Seed
    // conservatively: if the very first chunk is already loud (the user started
    // talking immediately), clamp to the configured floor so a high seed can't
    // push the enter-threshold out of reach and stall VAD for the whole session.
    if (!this.vadNoiseInit) {
      this.vadNoiseFloor = Math.min(energy, floor / 3);
      this.vadNoiseInit = true;
    }
    // Hysteresis: it takes more energy to *start* an utterance than to keep
    // one going, so a brief dip mid-sentence doesn't end it prematurely.
    // Do not let a near-threshold background ratchet sensitivity upwards
    // until a quiet word is permanently classified as more background.
    const enterThreshold = Math.max(floor, Math.min(floor * 1.5, this.vadNoiseFloor * 2.5));
    const exitThreshold = Math.max(floor * 0.7, Math.min(enterThreshold * 0.9, this.vadNoiseFloor * 1.6));
    const isVoiced = this.vadSpeaking ? energy >= exitThreshold : energy >= enterThreshold;

    if (!this.vadSpeaking) {
      if (isVoiced) {
        // Speech onset: prepend the pre-roll so the first syllable survives.
        this.vadSpeaking = true;
        this.vadSpeechMs = 0;
        this.vadSilenceMs = 0;
        for (const pre of this.vadPreRoll) {
          this.segmentBuffers.push(pre);
          this.segmentBytes += pre.length;
        }
        this.vadPreRoll = [];
        this.vadPreRollMs = 0;
        this.segmentBuffers.push(buffer);
        this.segmentBytes += buffer.length;
        this.vadSpeechMs += chunkMs;
      } else {
        // Background: adapt the noise floor and keep a short pre-roll ring.
        this.vadNoiseFloor = this.vadNoiseFloor * 0.95 + energy * 0.05;
        this.vadPreRoll.push(buffer);
        this.vadPreRollMs += chunkMs;
        const preRollLimit = this._getPreRollMs();
        while (this.vadPreRollMs > preRollLimit && this.vadPreRoll.length > 1) {
          const dropped = this.vadPreRoll.shift();
          this.vadPreRollMs -= this._chunkDurationMs(dropped);
        }
      }
      return;
    }

    // Already speaking: keep capturing (including trailing silence so word
    // endings aren't clipped) and watch for a pause that ends the utterance.
    this.segmentBuffers.push(buffer);
    this.segmentBytes += buffer.length;
    if (isVoiced) {
      this.vadSpeechMs += chunkMs;
      this.vadSilenceMs = 0;
    } else {
      this.vadSilenceMs += chunkMs;
    }

    const pausedLongEnough = this.vadSilenceMs >= this._getSilenceHangoverMs();
    const haveRealSpeech = this.vadSpeechMs >= this._getMinUtteranceMs();
    const tooLong = this.segmentBytes / 32 >= this._getMaxUtteranceMs();

    if ((pausedLongEnough && haveRealSpeech) || tooLong) {
      this._endUtteranceFlush({ forced: tooLong && !pausedLongEnough });
    } else if (pausedLongEnough && !haveRealSpeech) {
      // Just noise (cough/click) with no real speech — discard, don't waste a
      // Whisper spawn or risk a hallucinated transcript.
      this._discardWhisperUtterance();
    }
  }

  _discardWhisperUtterance() {
    this.segmentBuffers = [];
    this.segmentBytes = 0;
    this.vadSpeaking = false;
    this.vadSpeechMs = 0;
    this.vadSilenceMs = 0;
    this.vadPreRoll = [];
    this.vadPreRollMs = 0;
    this.segmentHasOverlap = false;
  }

  /** Flush the accumulated utterance and reset VAD for the next one. */
  _endUtteranceFlush({ forced = false } = {}) {
    const overlap = forced && this.segmentBytes
      ? Buffer.concat(this.segmentBuffers, this.segmentBytes).subarray(-400 * 32) : null;
    this.vadSpeaking = false;
    this.vadSpeechMs = 0;
    this.vadSilenceMs = 0;
    this.vadPreRoll = [];
    this.vadPreRollMs = 0;
    this._flushWhisperSegment({ final: false }).catch((error) => {
      logger.error('Whisper segment transcription failed', { error: error.message });
    });
    if (overlap && this.isRecording) {
      this.segmentBuffers = [overlap];
      this.segmentBytes = overlap.length;
      this.segmentHasOverlap = true;
      this.vadSpeaking = true;
      if (!this._isVadEnabled()) this.vadSpeechMs = overlap.length / 32;
    }
  }

  _chunkDurationMs(buffer) {
    // 16kHz mono 16-bit => 2 bytes/sample => 32 bytes/ms.
    return buffer.length / 32;
  }

  stopRecording() {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;
    const sessionDuration = this.sessionStartTime ? Date.now() - this.sessionStartTime : 0;
    logger.info('Stopping speech recognition session', {
      provider: this.provider,
      sessionDuration: `${sessionDuration}ms`
    });

    if (this.provider === 'azure' && this.recognizer) {
      this.isProcessingAudio = true;
      this.emit('recording-stopped');
      try {
        this.recognizer.stopContinuousRecognitionAsync(
          () => {
            this._finalizeStop('Recording stopped');
          },
          (error) => {
            logger.error('Error during recognition stop', { error: error.toString() });
            this._finalizeStop('Recording stopped');
          }
        );
      } catch (error) {
        logger.error('Error stopping recognizer', { error: error.message });
        this._finalizeStop('Recording stopped');
      }
      return;
    }

    if (this._isGeminiLiveProvider()) {
      this._stopGeminiLiveRecording();
      return;
    }

    if (this._isWhisperProvider()) {
      this.isProcessingAudio = true;
      this.emit('recording-stopped');
      this.emit('status', 'Processing system audio…');
      this._finalizeWhisperStop({ captureAlreadyStopped: true });
      return;
    }

    this._finalizeStop('Recording stopped');
  }

  async _finalizeWhisperStop({ captureAlreadyStopped = false } = {}) {
    const generation = this.transcriptionGeneration;
    if (this.segmentTimer) {
      clearInterval(this.segmentTimer);
      this.segmentTimer = null;
    }

    if (this.recording) {
      try {
        this.recording.stop();
      } catch (error) {
        logger.error('Error stopping audio recording', { error: error.message });
      }
      this.recording = null;
    }

    try {
      if (this.segmentHasOverlap && this.segmentBytes <= 400 * 32) this._discardWhisperUtterance();
      if (!this._isManualCaptureMode() && this._isVadEnabled() && this.vadSpeechMs < this._getMinUtteranceMs()) {
        this._discardWhisperUtterance();
      }
      await this._flushWhisperSegment({ final: true });
    } catch (error) {
      logger.error('Final Whisper transcription failed', { error: error.message });
    } finally {
      // A failed/cancelled task must never clean up a new recording session.
      if (generation !== this.transcriptionGeneration) return;
      this._cleanup();
      this.isProcessingAudio = false;
      this.whisperWorker.releaseWhenIdle();
      if (!captureAlreadyStopped) {
        this.emit('recording-stopped');
      }
      this.emit('status', 'Recording stopped');
    }
  }

  _finalizeStop(statusMessage) {
    this.isRecording = false;
    this.isProcessingAudio = false;
    this._cleanup();
    this.emit('recording-stopped');
    this.emit('status', statusMessage);
  }

  _cleanup() {
    this.transcriptionGeneration = (this.transcriptionGeneration || 0) + 1;
    if (this.transcriptionAbortController) {
      this.transcriptionAbortController.abort(Object.assign(new Error('Transcription cancelled'), { code: 'ABORT_ERR' }));
      this.transcriptionAbortController = null;
    }
    if (this.liveLimitTimer) { clearTimeout(this.liveLimitTimer); this.liveLimitTimer = null; }
    if (this.liveSession) {
      const live = this.liveSession;
      this.liveSession = null;
      live.close();
    }
    if (this.segmentTimer) {
      clearInterval(this.segmentTimer);
      this.segmentTimer = null;
    }

    if (this.recognizer) {
      try {
        this.recognizer.close();
      } catch (error) {
        logger.error('Error closing recognizer', { error: error.message });
      }
      this.recognizer = null;
    }

    if (this.audioConfig) {
      try {
        if (typeof this.audioConfig.close === 'function') {
          this.audioConfig.close();
        }
      } catch (error) {
        logger.error('Error closing audio config', { error: error.message });
      }
      this.audioConfig = null;
    }

    if (this.recording) {
      try {
        this.recording.stop();
      } catch (error) {
        logger.error('Error stopping audio recording', { error: error.message });
      }
      this.recording = null;
    }

    if (this.pushStream) {
      try {
        if (typeof this.pushStream.close === 'function') {
          this.pushStream.close();
        }
      } catch (error) {
        logger.error('Error closing push stream', { error: error.message });
      }
      this.pushStream = null;
    }

    this.segmentBuffers = [];
    this.segmentBytes = 0;
    this.transcriptionInFlight = false;
    this.transcriptionQueue = [];
    this.queuedAudioBytes = 0;
    this.transcriptionTask = null;
    this.segmentHasOverlap = false;
    this.previousWhisperTranscript = '';
    this._resetVadState();
    this._audioDataLogged = false;
    this.useRendererCapture = false;
  }

  async recognizeFromFile(audioFilePath) {
    if (this.provider === 'azure') {
      if (!this.speechConfig) {
        throw new Error('Speech service not initialized');
      }

      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      const audioConfig = sdk.AudioConfig.fromWavFileInput(audioFilePath);
      const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

      return await new Promise((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            resolve(result.reason === sdk.ResultReason.RecognizedSpeech ? result.text : '');
            recognizer.close();
            audioConfig.close();
          },
          (error) => {
            reject(new Error(`File recognition error: ${error}`));
            recognizer.close();
            audioConfig.close();
          }
        );
      });
    }

    if (this.provider === 'whisper') {
      return this._transcribeWhisperFile(audioFilePath);
    }
    if (this.provider === 'cloudflare') {
      return cloudflareSpeech.transcribe(fs.readFileSync(audioFilePath), this._getWhisperLanguage());
    }

    throw new Error('Speech service not initialized');
  }

  async testConnection() {
    if (this._isGeminiLiveProvider()) {
      if (this.provider === 'gemini-live-audio' && !this.usesLiveAudioAnswers()) return { success: false, message: 'Select Gemini-3.8-Live in AI Providers to use its audio input' };
      if (!process.versions?.electron) return { success: false, message: 'Live API requires Electron networking. Use scripts/run-electron.js scripts/aistudio-live.js --env <path> --text "Reply with OK."' };
      const liveAPI = require('./gemini-live.service');
      const live = this.usesLiveAudioAnswers() ? liveAPI.createAudioConversation({ contents: [] }) : liveAPI.createTranscription({ languageCodes: this._getGeminiTranscribeLanguages() });
      try { await live.connect(); return { success: true, message: 'Gemini Live connected (no audio uploaded)' }; }
      catch (error) { return { success: false, message: error.message }; }
      finally { live.close(); }
    }
    if (this.provider === 'cloudflare') {
      return { success: cloudflareSpeech.isConfigured(), message: 'Cloudflare configuration check (no audio uploaded)' };
    }
    if (this.provider === 'azure') {
      if (!this.speechConfig) {
        throw new Error('Speech service not initialized');
      }

      try {
        const stream = sdk.AudioInputStream.createPushStream();
        const audioConfig = sdk.AudioConfig.fromStreamInput(stream);
        const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);
        recognizer.close();
        audioConfig.close();
        stream.close();
        return { success: true, message: 'Azure connection test successful' };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }

    if (this.provider === 'whisper') {
      if (!this.whisperCommand) {
        return { success: false, message: 'Local Whisper CLI not found' };
      }
      if (this.whisperWorker.isConfigured()) {
        try {
          const result = await this.whisperWorker.diagnose({ device: this._getWhisperDevice() });
          return { ...result, success: true, message: result.device === 'cuda'
            ? `Local Whisper CUDA compute verified: ${result.gpu} (PyTorch ${result.torch})`
            : `Local Whisper uses CPU (PyTorch ${result.torch}). GPU inference was not verified.` };
        } catch (error) {
          return { success: false, code: error.code, message: error.message };
        } finally {
          this.whisperWorker.releaseWhenIdle();
        }
      }
      // Actually probe the executable to confirm it works
      const probe = spawnSync(
        this.whisperCommand.command,
        [...this.whisperCommand.baseArgs, '--help'],
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      );
      if (probe.error || probe.status !== 0) {
        const err = probe.error ? probe.error.message : `exit code ${probe.status}`;
        return {
          success: false,
          message: `Local Whisper CLI detected but probe failed: ${err}`
        };
      }
      return {
        success: this._getWhisperDevice() !== 'cuda',
        gpu_verified: false,
        message: 'Local Whisper CLI is available, but GPU computation could not be verified. Configure WHISPER_PYTHON with the interpreter used by this CLI.'
      };
    }

    return { success: false, message: 'Speech service not initialized' };
  }

  getStatus() {
    return {
      provider: this.provider,
      isRecording: this.isRecording,
      isProcessingAudio: this.isProcessingAudio,
      isInitialized: this.provider === 'azure' ? !!this.speechConfig : this.isAvailable(),
      sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      retryCount: this.retryCount,
      effectiveSettings: {
        speechProvider: this.provider,
        azureRegion: this._getSetting('azureRegion') || process.env.AZURE_SPEECH_REGION || '',
        whisperCommand: this._getSetting('whisperCommand') || process.env.WHISPER_COMMAND || '',
        whisperModelDir: this._getWhisperModelDir(),
        whisperModel: this._getWhisperModel(),
        whisperLanguage: this._getWhisperLanguage(),
        whisperCaptureMode: this._getWhisperCaptureMode(),
        whisperDevice: this._getWhisperDevice(),
        whisperSegmentMs: String(this._getWhisperSegmentMs())
      },
      config: {
        azure: config.get('speech.azure') || {},
        whisper: config.get('speech.whisper') || {},
        selectedProvider: this.provider
      }
    };
  }

  isAvailable() {
    if (this._isGeminiLiveProvider()) return this.available && require('../core/ai-settings').isConfiguredKey(process.env.GEMINI_API_KEY);
    if (this.provider === 'cloudflare') return this.available && cloudflareSpeech.isConfigured();
    if (this.provider === 'azure') {
      return !!this.speechConfig && !!this.available;
    }

    if (this.provider === 'whisper') {
      return !!this.whisperCommand && !!this.available;
    }

    return false;
  }

  isManualCaptureMode() {
    return (this._isWhisperProvider() || this._isGeminiLiveProvider()) && this._getWhisperCaptureMode() === 'manual';
  }

  usesLiveAudioAnswers() {
    return this.provider === 'gemini-live-audio' && process.env.LLM_PROVIDER === 'gemini-live';
  }

  _isGeminiLiveProvider() {
    return ['gemini-live', 'gemini-live-audio'].includes(this.provider);
  }

  _getGeminiTranscribeLanguages() {
    if (this._hasDialogueLanguages()) return this._getDialogueLanguages();
    return require('../core/gemini-transcribe-languages').parse(this._getSetting('geminiTranscribeLanguages') ?? process.env.GEMINI_TRANSCRIBE_LANGUAGES ?? '');
  }

  _hasDialogueLanguages() {
    return this._getSetting('dialogueLanguages') !== undefined || process.env.DIALOGUE_LANGUAGES !== undefined;
  }

  _getDialogueLanguages() {
    const runtime = this._getSetting('dialogueLanguages');
    const env = runtime === undefined ? process.env : { ...process.env, DIALOGUE_LANGUAGES: runtime };
    return require('../core/dialogue-languages').getDialogueLanguages(env);
  }

  cancelLiveRecording() {
    if (!this.liveSession) return;
    // Report cancellation while listeners still own the active response ID.
    this.liveSession.close();
  }

  _getGeminiTranscribeVocabulary() {
    return require('../core/transcription-vocabulary').parseVocabulary(
      this._getSetting('geminiTranscribeVocabulary') ?? process.env.GEMINI_TRANSCRIBE_VOCABULARY ?? require('../core/ai-settings').DEFAULTS.geminiTranscribeVocabulary
    );
  }

  shutdown() {
    this.isRecording = false;
    this.isProcessingAudio = false;
    this._cleanup();
    this.whisperWorker.close();
  }

  updateSettings(settings = {}) {
    const speechKeys = ['speechProvider', 'dialogueLanguages', 'geminiTranscribeLanguages', 'geminiTranscribeVocabulary', 'azureKey', 'azureRegion', 'whisperCommand', 'whisperModelDir', 'whisperModel', 'whisperLanguage', 'whisperCaptureMode', 'whisperDevice', 'whisperSegmentMs'];
    let changed = false;

    for (const key of speechKeys) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        this.runtimeSettings[key] = settings[key];
        changed = true;
      }
    }

    if (changed) {
      this.initializeClient();
    }

    return this.getStatus();
  }

  _getConfiguredProvider() {
    const provider = String(this._getSetting('speechProvider') || process.env.SPEECH_PROVIDER || '').trim().toLowerCase();

    if (['azure', 'whisper', 'cloudflare', 'gemini-live', 'gemini-live-audio', 'disabled'].includes(provider)) {
      return provider;
    }

    const hasAzure = !!((this._getSetting('azureKey') || process.env.AZURE_SPEECH_KEY) &&
      (this._getSetting('azureRegion') || process.env.AZURE_SPEECH_REGION));

    if (hasAzure) {
      return 'azure';
    }

    return 'whisper';
  }

  _getWhisperModel() {
    return this._getSetting('whisperModel') || process.env.WHISPER_MODEL || config.get('speech.whisper.model') || 'small';
  }

  _getWhisperModelDir() {
    const configured = this._getSetting('whisperModelDir') || process.env.WHISPER_MODEL_DIR || '';
    // Honor an absolute configured dir. Empty or relative values (the old
    // `.whisper-models` default resolved against an unstable cwd) are replaced
    // with the stable userData location the installer downloads weights into,
    // so --model_dir and download_root always agree.
    if (configured && path.isAbsolute(configured)) {
      return configured;
    }
    return this._getUserDataModelDir() || configured;
  }

  /**
   * Absolute model-weights dir under Electron userData — matches
   * WhisperInstaller.modelDir so transcription finds downloaded models.
   */
  _getUserDataModelDir() {
    try {
      const { app } = require('electron');
      return path.join(app.getPath('userData'), '.whisper-models');
    } catch (_) {
      return '';
    }
  }

  _getWhisperLanguage() {
    if (this._hasDialogueLanguages()) return require('../core/dialogue-languages').getWhisperLanguage(this._getDialogueLanguages());
    return this._getSetting('whisperLanguage') || process.env.WHISPER_LANGUAGE || config.get('speech.whisper.language') || 'auto';
  }

  _getWhisperSegmentMs() {
    const rawValue = this._getSetting('whisperSegmentMs') || process.env.WHISPER_SEGMENT_MS || config.get('speech.whisper.segmentMs') || 4000;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? Math.max(2000, parsed) : 4000;
  }

  _vadNumber(settingKey, envKey, configPath, fallback, min) {
    const raw = this._getSetting(settingKey) || process.env[envKey] || config.get(configPath) || fallback;
    const parsed = Number(raw);
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return typeof min === 'number' ? Math.max(min, value) : value;
  }

  _isVadEnabled() {
    const override = this._getSetting('whisperVadEnabled');
    if (override === false || override === 'false') return false;
    if (override === true || override === 'true') return true;
    if (process.env.WHISPER_VAD_ENABLED === 'false') return false;
    const configured = config.get('speech.whisper.vadEnabled');
    return configured !== false;
  }

  _getSilenceHangoverMs() {
    return this._vadNumber('whisperSilenceHangoverMs', 'WHISPER_SILENCE_HANGOVER_MS', 'speech.whisper.silenceHangoverMs', 700, 200);
  }

  _getMinUtteranceMs() {
    return this._vadNumber('whisperMinUtteranceMs', 'WHISPER_MIN_UTTERANCE_MS', 'speech.whisper.minUtteranceMs', 80, 40);
  }

  _getMaxUtteranceMs() {
    return this._vadNumber('whisperMaxUtteranceMs', 'WHISPER_MAX_UTTERANCE_MS', 'speech.whisper.maxUtteranceMs', 15000, 2000);
  }

  _getPreRollMs() {
    return this._vadNumber('whisperPreRollMs', 'WHISPER_PRE_ROLL_MS', 'speech.whisper.preRollMs', 300, 0);
  }

  _getVadEnergyFloor() {
    return this._vadNumber('whisperVadEnergyFloor', 'WHISPER_VAD_ENERGY_FLOOR', 'speech.whisper.vadEnergyFloor', 0.0015, 0.0005);
  }

  _getSetting(key) {
    const value = this.runtimeSettings[key];
    return value === '' ? null : value;
  }

  _isManualCaptureMode() {
    return this._getWhisperCaptureMode() === 'manual';
  }

  _getWhisperCaptureMode() {
    const configured = String(
      this._getSetting('whisperCaptureMode') || process.env.WHISPER_CAPTURE_MODE || ''
    ).trim().toLowerCase();
    if (configured === 'manual' || configured === 'vad') {
      return configured;
    }

    // Backward compatibility for existing local configurations.
    if (process.env.WHISPER_MANUAL_CAPTURE !== undefined) {
      return process.env.WHISPER_MANUAL_CAPTURE === 'false' ? 'vad' : 'manual';
    }
    return 'vad';
  }

  _getManualCaptureMaxMs() {
    const parsed = Number(process.env.WHISPER_MANUAL_MAX_MS || 90000);
    return Number.isFinite(parsed) ? Math.max(5000, parsed) : 90000;
  }

  _getWhisperDevice() {
    const device = String(this._getSetting('whisperDevice') || process.env.WHISPER_DEVICE || 'auto').trim().toLowerCase();
    if (!['auto', 'cpu', 'cuda'].includes(device)) throw new Error('Whisper device must be auto, cpu or cuda');
    return device;
  }

  _getWhisperPythonPath() {
    const configuredPython = String(process.env.WHISPER_PYTHON || '').trim();
    if (configuredPython) {
      const resolvedPython = path.isAbsolute(configuredPython)
        ? path.normalize(configuredPython)
        : path.resolve(configuredPython);
      if (fs.existsSync(resolvedPython)) {
        return resolvedPython;
      }
    }

    if (!this.whisperCommand) {
      return null;
    }

    const command = path.normalize(this.whisperCommand.command);
    const moduleIndex = this.whisperCommand.baseArgs.indexOf('-m');
    if (
      moduleIndex !== -1 &&
      this.whisperCommand.baseArgs[moduleIndex + 1] === 'whisper' &&
      fs.existsSync(command)
    ) {
      return command;
    }

    const pythonName = process.platform === 'win32' ? 'python.exe' : 'python';
    const siblingPython = path.join(path.dirname(command), pythonName);
    if (fs.existsSync(siblingPython)) return siblingPython;
    const userDataCandidate = this._getUserDataWhisperCandidate();
    return userDataCandidate && fs.existsSync(userDataCandidate.command) ? userDataCandidate.command : null;
  }

  _getWhisperWorkerScriptPath() {
    const sourcePath = path.resolve(__dirname, '..', '..', 'scripts', 'whisper_worker.py');
    return sourcePath.includes('app.asar')
      ? sourcePath.replace('app.asar', 'app.asar.unpacked')
      : sourcePath;
  }

  _configureWhisperWorker() {
    const pythonPath = this._getWhisperPythonPath();
    const scriptPath = this._getWhisperWorkerScriptPath();
    const idleUnloadMs = Math.max(10000, Number(process.env.WHISPER_GPU_IDLE_MS || 60000));
    this.whisperWorker.configure({ pythonPath, scriptPath, idleUnloadMs });

    logger.info('Whisper worker configuration', {
      configured: this.whisperWorker.isConfigured(),
      pythonPath,
      scriptPath,
      device: this._getWhisperDevice(),
      idleUnloadMs
    });
  }

  /**
   * Build a whisper candidate pointing at the app-local venv inside
   * Electron's userData directory. This is where the onboarding installer
   * creates the venv in packaged builds.
   */
  _getUserDataWhisperCandidate() {
    try {
      const { app } = require('electron');
      const userData = app.getPath('userData');
      const binDir = process.platform === 'win32' ? 'Scripts' : 'bin';
      const ext = process.platform === 'win32' ? '.exe' : '';
      const python = path.join(userData, '.venv-whisper', binDir, `python${ext}`);
      if (fs.existsSync(python)) {
        return { command: python, baseArgs: ['-m', 'whisper'] };
      }
    } catch (_) {
      // electron may not be available in unit tests
    }
    return null;
  }

  _resolveWhisperCommand() {
    const configured = this._getSetting('whisperCommand') || process.env.WHISPER_COMMAND;
    const candidates = [];

    if (configured) {
      candidates.push(...this._expandConfiguredWhisperCandidates(configured));
    }

    // Persistent app venv (highest priority after explicit config)
    const userDataVenv = this._getUserDataWhisperCandidate();
    if (userDataVenv) {
      candidates.push({ ...userDataVenv, source: 'app userData venv' });
    }

    // Platform-aware fallback candidates (higher priority = tried first)
    candidates.push({ command: 'whisper', baseArgs: [], source: 'system PATH' });
    if (process.platform === 'win32') {
      candidates.push({ command: 'whisper.exe', baseArgs: [], source: 'system PATH (exe)' });
      candidates.push({ command: 'py', baseArgs: ['-3', '-m', 'whisper'], source: 'py launcher' });
    }
    candidates.push({ command: 'python3', baseArgs: ['-m', 'whisper'], source: 'python3 module' });
    candidates.push({ command: 'python', baseArgs: ['-m', 'whisper'], source: 'python module' });

    for (const candidate of candidates) {
      if (!candidate || !candidate.command) {
        continue;
      }

      const resolved = this._probeWhisperCandidate(candidate);
      if (resolved) {
        logger.info('Whisper command resolved', {
          command: resolved.command,
          baseArgs: resolved.baseArgs,
          source: resolved.source || candidate.source || 'unknown'
        });
        return resolved;
      }
    }

    logger.warn('No Whisper CLI candidate succeeded after probing all fallbacks');
    return null;
  }

  /**
   * Fast, torch-free check for python `-m whisper` candidates. Importing the
   * whisper package pulls in torch/numba and can take well over 8 s on a cold
   * cache (first run after install), which made `--help` time out and the mic
   * button stay hidden until a second launch. `importlib.util.find_spec`
   * confirms the module is installed without importing it, returning in well
   * under a second. Returns the candidate on success, else null.
   */
  _probeWhisperModuleFast(candidate) {
    const mIdx = candidate.baseArgs.indexOf('-m');
    if (mIdx === -1 || candidate.baseArgs[mIdx + 1] !== 'whisper') {
      return null; // not a `-m whisper` form (e.g. a whisper binary)
    }
    const pyArgs = candidate.baseArgs.slice(0, mIdx);
    const script = 'import importlib.util,sys; sys.exit(0 if importlib.util.find_spec("whisper") else 1)';
    try {
      // No shell: an absolute .exe runs directly. shell:true on Windows does
      // NOT quote args, so a spaced path like
      //   C:\Users\CANDAN SINGH\...\python.exe
      // would be split at the space and the probe would wrongly fail —
      // hiding the mic for any user whose profile name contains a space.
      const probe = spawnSync(candidate.command, [...pyArgs, '-c', script], {
        encoding: 'utf8',
        timeout: 8000,
        windowsHide: true,
      });
      if (!probe.error && probe.status === 0) {
        return candidate;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  /**
   * Probe a single candidate: exists check → fast module check → spawn --help.
   * Returns the working candidate object, or null on failure.
   */
  _probeWhisperCandidate(candidate) {
    const cmd = candidate.command;
    const args = [...candidate.baseArgs, '--help'];

    // Fast path: skip spawnSync if the file clearly doesn't exist
    if (path.isAbsolute(cmd) || cmd.includes(path.sep) || cmd.includes('/')) {
      try {
        const normalized = path.normalize(cmd);
        if (!fs.existsSync(normalized)) {
          logger.debug('Whisper probe skipped: file does not exist', {
            command: cmd,
            normalized
          });
          return null;
        }
      } catch (e) {
        // fs.existsSync can throw on invalid paths; treat as missing
        return null;
      }
    }

    // Cheap torch-free check first so the mic appears on the first run.
    const fast = this._probeWhisperModuleFast(candidate);
    if (fast) {
      logger.debug('Whisper module confirmed via find_spec', { command: cmd });
      return fast;
    }

    let probe;
    try {
      probe = spawnSync(cmd, args, {
        encoding: 'utf8',
        // First `import whisper` (torch/numba) can be slow on a cold cache.
        timeout: 30000,
        windowsHide: true,
        // No shell — see _probeWhisperModuleFast: shell:true on Windows splits
        // spaced paths (e.g. "C:\Users\CANDAN SINGH\...") and breaks the probe.
      });
    } catch (spawnErr) {
      logger.debug('Whisper probe spawn error', {
        command: cmd,
        error: spawnErr.message
      });
      return null;
    }

    const output = `${probe.stdout || ''}\n${probe.stderr || ''}`;
    const noModule = output.includes('No module named whisper');
    const isHelpOutput = output.includes('usage:') || output.includes('whisper') || output.includes('options');

    if (!probe.error && probe.status === 0 && !noModule) {
      return candidate;
    }

    // Some whisper builds exit with non-zero on --help but still print usage
    if (!probe.error && !noModule && isHelpOutput) {
      logger.debug('Whisper probe accepted non-zero help output', {
        command: cmd,
        status: probe.status
      });
      return candidate;
    }

    logger.debug('Whisper probe failed', {
      command: cmd,
      status: probe.status,
      error: probe.error ? probe.error.message : null,
      noModule,
      isHelpOutput,
      outputPreview: output.substring(0, 200)
    });
    return null;
  }

  _expandConfiguredWhisperCandidates(rawCommand) {
    const parsed = this._parseCommand(rawCommand);
    if (!parsed) {
      return [];
    }

    const candidates = [];
    // Normalize forward slashes to platform separator before trying anything
    const normalizedCmd = path.normalize(parsed.command);

    candidates.push({
      command: normalizedCmd,
      baseArgs: parsed.baseArgs,
      source: 'configured (normalized)'
    });

    const resolvedPath = path.resolve(normalizedCmd);
    if (resolvedPath !== normalizedCmd) {
      candidates.push({
        command: resolvedPath,
        baseArgs: parsed.baseArgs,
        source: 'configured (resolved)'
      });
    }

    if (process.platform === 'win32') {
      const base = normalizedCmd;
      // Try .exe / .cmd / .bat variants when extension is missing
      if (!/\.(exe|cmd|bat)$/i.test(base)) {
        candidates.push({ command: `${base}.exe`, baseArgs: parsed.baseArgs, source: 'configured (.exe)' });
        candidates.push({ command: `${base}.cmd`, baseArgs: parsed.baseArgs, source: 'configured (.cmd)' });
        if (resolvedPath !== base) {
          candidates.push({ command: `${resolvedPath}.exe`, baseArgs: parsed.baseArgs, source: 'configured (resolved .exe)' });
        }
      }
      // Some Windows venvs create whisper-script.py alongside whisper.exe
      const scriptPath = base + '-script.py';
      candidates.push({ command: 'python', baseArgs: [scriptPath, ...parsed.baseArgs], source: 'configured (script.py)' });
      // Try using the venv's own python with -m whisper
      const venvPython = path.join(path.dirname(base), 'python.exe');
      if (fs.existsSync(venvPython)) {
        candidates.push({ command: venvPython, baseArgs: ['-m', 'whisper', ...parsed.baseArgs], source: 'configured (venv python -m whisper)' });
      }
    } else {
      // On Unix, try the directory's python3 with -m whisper if the configured path looks like a venv entry point
      const venvPython3 = path.join(path.dirname(normalizedCmd), 'python3');
      if (fs.existsSync(venvPython3)) {
        candidates.push({ command: venvPython3, baseArgs: ['-m', 'whisper', ...parsed.baseArgs], source: 'configured (venv python3 -m whisper)' });
      }
      const venvPython = path.join(path.dirname(normalizedCmd), 'python');
      if (fs.existsSync(venvPython)) {
        candidates.push({ command: venvPython, baseArgs: ['-m', 'whisper', ...parsed.baseArgs], source: 'configured (venv python -m whisper)' });
      }
    }

    return candidates;
  }

  _parseCommand(rawCommand) {
    // Respect double-quoted segments so Windows userData paths like
    // "C:\Users\CANDAN SINGH\...\python.exe" survive intact.
    const trimmed = String(rawCommand || '').trim();
    if (!trimmed) {
      return null;
    }
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [trimmed];
    const normalized = parts.map((p) => p.replace(/^"|"$/g, '')).filter(Boolean);
    if (normalized.length === 0) {
      return null;
    }

    return {
      command: normalized[0],
      baseArgs: normalized.slice(1)
    };
  }

  _handleAudioChunk(chunk) {
    if (!chunk || !chunk.length || !this.isRecording) {
      return;
    }

    if (this._isGeminiLiveProvider()) {
      try {
        const buffer = Buffer.from(chunk);
        if (this._chunkRmsEnergy(buffer) >= this._getVadEnergyFloor()) this.liveHadSpeech = true;
        this.liveAudioBytes += buffer.length;
        this.liveSession.sendAudio(buffer);
        if (this.isManualCaptureMode() && this.liveAudioBytes / 32 >= this._getManualCaptureMaxMs()) this.stopRecording();
      } catch (error) { this._abortGeminiLive(error); }
      return;
    }

    if (this.provider === 'azure' && this.pushStream) {
      try {
        this.pushStream.write(chunk);
      } catch (error) {
        logger.error('Error writing audio data to Azure push stream', { error: error.message });
      }
      return;
    }

    if (this._isWhisperProvider()) {
      this._ingestWhisperAudio(Buffer.from(chunk));
    }
  }

  _flushWhisperSegment() {
    if (this.segmentBytes) {
      const audioBuffer = Buffer.concat(this.segmentBuffers, this.segmentBytes);
      this.segmentBuffers = [];
      this.segmentBytes = 0;
      this.transcriptionQueue.push({ audioBuffer, hasOverlap: !!this.segmentHasOverlap });
      this.segmentHasOverlap = false;
      this.queuedAudioBytes += audioBuffer.length;
    }
    if (!this.transcriptionInFlight && this.transcriptionQueue.length) {
      const generation = this.transcriptionGeneration;
      this.transcriptionInFlight = true;
      this.transcriptionTask = this._drainWhisperQueue(generation).catch(error => {
        if (generation === this.transcriptionGeneration) {
          const wasRecording = this.isRecording;
          this.isRecording = false;
          this.isProcessingAudio = false;
          this._cleanup();
          this.whisperWorker.releaseWhenIdle();
          if (wasRecording) this.emit('recording-stopped');
          this.emit('error', `Transcription failed: ${error.message}. Recording stopped; unprocessed speech was discarded. Start recording again to continue.`);
          this.emit('status', 'Transcription failed; recording stopped');
        }
        throw error;
      });
    }
    const task = this.transcriptionTask || Promise.resolve();
    // Keep complete utterances in order. Stop capture at one minute of backlog
    // and drain it, rather than merging unlimited audio into one huge request.
    if (this.isRecording && this.queuedAudioBytes >= this._getMaxQueuedAudioBytes()) {
      this.stopRecording();
      this.emit('status', 'Transcription is slower than recording. Capture stopped; processing queued speech.');
    }
    return task;
  }

  _getMaxQueuedAudioBytes() {
    return 60000 * 32; // 60 seconds of 16 kHz mono PCM16, excluding the active request.
  }

  _getTranscriptionTimeoutMs() {
    return this.provider === 'cloudflare' ? 120000 : 180000;
  }

  async _drainWhisperQueue(generation) {
    try {
      while (generation === this.transcriptionGeneration && this.transcriptionQueue.length) {
        const { audioBuffer, hasOverlap } = this.transcriptionQueue.shift();
        this.queuedAudioBytes -= audioBuffer.length;
        const transcript = await this._transcribeWhisperSegment(audioBuffer);
        if (generation !== this.transcriptionGeneration) return;
        const clean = transcript ? transcript.trim() : '';
        if (clean && !this._isHallucinatedTranscript(clean)) {
          const text = hasOverlap
            ? require('../core/transcript-overlap').removeTranscriptOverlap(this.previousWhisperTranscript, clean) : clean;
          this.previousWhisperTranscript = clean;
          if (text) this.emit('transcription', text);
        }
      }
    } finally {
      if (generation === this.transcriptionGeneration) this.transcriptionInFlight = false;
    }
  }

  async _transcribeWhisperSegment(audioBuffer) {
    const controller = new AbortController();
    this.transcriptionAbortController = controller;
    let deadline;
    let onAbort;
    try {
      const cancelled = new Promise((resolve, reject) => {
        onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', onAbort, { once: true });
        deadline = setTimeout(() => controller.abort(Object.assign(
          new Error('Speech transcription timed out'), { code: 'TRANSCRIPTION_TIMEOUT' }
        )), this._getTranscriptionTimeoutMs());
      });
      return await Promise.race([
        cancelled,
        (async () => {
          const { isRetryableSpeechError, waitForSpeechRetry } = require('../core/speech-retry');
          for (let attempt = 1; ; attempt++) {
            try { return await this._transcribeWhisperBuffer(audioBuffer, { signal: controller.signal }); }
            catch (error) {
              if (controller.signal.aborted || attempt >= 3 || !isRetryableSpeechError(error)) throw error;
              this.emit('status', `Temporary speech service error; retrying (${attempt}/2)…`);
              await waitForSpeechRetry(attempt, controller.signal);
            }
          }
        })()
      ]);
    } finally {
      clearTimeout(deadline);
      controller.signal.removeEventListener('abort', onAbort);
      if (this.transcriptionAbortController === controller) this.transcriptionAbortController = null;
    }
  }

  /**
   * Whisper reliably hallucinates a small set of stock phrases when fed near-
   * silence or non-speech audio (training-data artifacts from video captions).
   * VAD already prevents most silent flushes; this is the final guard so these
   * phantom phrases never reach the chat or the LLM.
   */
  _isHallucinatedTranscript(text) {
    const normalized = text.toLowerCase().replace(/[\s.,!?¡¿"'`]+/g, ' ').trim();
    if (!normalized) {
      return true;
    }
    const HALLUCINATIONS = new Set([
      'thank you for watching',
      'thanks for watching',
      'thank you so much for watching',
      'please subscribe',
      'like and subscribe',
      'subtitles by the amara org community'
    ]);
    return HALLUCINATIONS.has(normalized);
  }

  _normalizeWhisperAudio(audioBuffer) {
    let peak = 0;
    for (let i = 0; i < audioBuffer.length; i += 2) peak = Math.max(peak, Math.abs(audioBuffer.readInt16LE(i)));
    // Modest gain for quiet speech; leave silence and normal/loud audio alone.
    const gain = peak ? Math.min(8, 6553 / peak) : 1;
    if (gain <= 1) return audioBuffer;
    const normalized = Buffer.alloc(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i += 2) normalized.writeInt16LE(Math.round(audioBuffer.readInt16LE(i) * gain), i);
    return normalized;
  }

  async _transcribeWhisperBuffer(audioBuffer, { signal } = {}) {
    audioBuffer = this._normalizeWhisperAudio(audioBuffer);
    if (this.provider === 'cloudflare') {
      return cloudflareSpeech.transcribe(this._createWavBuffer(audioBuffer), this._getWhisperLanguage(), undefined, { signal });
    }
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencluely-whisper-'));
    const audioFilePath = path.join(tempDir, 'segment.wav');

    try {
      fs.writeFileSync(audioFilePath, this._createWavBuffer(audioBuffer));
      return await this._transcribeWhisperFile(audioFilePath, { signal });
    } finally {
      this._removeTempDir(tempDir);
    }
  }

  async _transcribeWhisperFile(audioFilePath, { signal } = {}) {
    if (signal?.aborted) throw signal.reason;
    if (!this.whisperCommand) {
      throw new Error('Local Whisper CLI not configured');
    }

    if (this.whisperWorker.isConfigured()) {
      const startedAt = Date.now();
      try {
        const result = await this.whisperWorker.transcribe(audioFilePath, {
          model: this._getWhisperModel(),
          language: this._getWhisperLanguage(),
          modelDir: this._getWhisperModelDir(),
          device: this._getWhisperDevice(), signal
        });
        logger.info('Persistent Whisper transcription completed', {
          processingTime: Date.now() - startedAt,
          model: result.model,
          device: result.device,
          gpu: result.gpu,
          detectedLanguage: result.language
        });
        return result.text || '';
      } catch (error) {
        if (signal?.aborted || /^(CUDA_|WHISPER_TIMEOUT|TRANSCRIPTION_TIMEOUT|ABORT_ERR)/.test(String(error.code || ''))) throw error;
        this.whisperWorker.close();
        logger.warn('Persistent Whisper worker failed; falling back to CLI', {
          error: error.message,
          workerTraceback: error.workerTraceback
        });
      }
    }

    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencluely-whisper-out-'));
    const args = [
      ...this.whisperCommand.baseArgs,
      audioFilePath,
      '--model', this._getWhisperModel(),
      '--task', 'transcribe',
      '--output_format', 'txt',
      '--output_dir', outputDir,
      '--verbose', 'False',
      '--fp16', this._getWhisperDevice() === 'cpu' ? 'False' : 'True',
      '--temperature', '0',
      '--condition_on_previous_text', 'False'
    ];

    const device = this._getWhisperDevice();
    // Whisper's CLI defaults to CUDA when available. It does not accept auto.
    if (device !== 'auto') args.push('--device', device);

    const language = this._getWhisperLanguage();
    if (language && language !== 'auto' && language !== 'detect') {
      args.push('--language', language);
    }

    if (this._getWhisperModelDir()) {
      args.push('--model_dir', this._getWhisperModelDir());
    }

    try {
      await new Promise((resolve, reject) => {
        const child = spawn(this.whisperCommand.command, args, {
          stdio: ['ignore', 'ignore', 'pipe'],
          windowsHide: true,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let settled = false;
        const finish = (error, terminate = false) => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          signal?.removeEventListener('abort', onAbort);
          if (terminate) {
            try { child.kill(); }
            catch (killError) { logger.warn('Could not stop Whisper CLI', { error: killError.message }); }
          }
          if (error) reject(error); else resolve();
        };
        const onAbort = () => finish(signal.reason, true);
        const deadline = setTimeout(() => finish(Object.assign(
          new Error('Whisper CLI transcription timed out'), { code: 'WHISPER_TIMEOUT' }
        ), true), this._getTranscriptionTimeoutMs());
        signal?.addEventListener('abort', onAbort, { once: true });
        let stderr = '';
        child.stderr.on('data', (chunk) => {
          stderr = (stderr + chunk.toString()).slice(-8192);
        });

        child.on('error', (error) => {
          finish(error);
        });

        child.on('close', (code) => {
          if (code === 0) {
            finish();
            return;
          }

          finish(new Error(stderr.trim() || `Whisper exited with code ${code}`));
        });
        if (signal?.aborted) onAbort();
      });

      const transcriptPath = path.join(outputDir, `${path.parse(audioFilePath).name}.txt`);
      if (!fs.existsSync(transcriptPath)) {
        return '';
      }

      return fs.readFileSync(transcriptPath, 'utf8').trim();
    } finally {
      this._removeTempDir(outputDir);
    }
  }

  _createWavBuffer(rawPcmBuffer) {
    const header = Buffer.alloc(44);
    const sampleRate = 16000;
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + rawPcmBuffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(rawPcmBuffer.length, 40);

    return Buffer.concat([header, rawPcmBuffer]);
  }

  _removeTempDir(tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      logger.error('Failed to remove Whisper temp directory', {
        tempDir,
        error: error.message
      });
    }
  }
}

module.exports = new SpeechService();
