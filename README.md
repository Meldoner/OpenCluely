<div align="center">

# OpenCluely

**The invisible AI interview copilot.**

Real-time AI help on a stealth overlay that screen sharing cannot see. Ask by voice or screenshot, and get clear answers that stream in as you need them.

<p>
  <a href="https://github.com/TechyCSR/OpenCluely/releases/latest"><img src="https://img.shields.io/github/v/release/TechyCSR/OpenCluely?style=for-the-badge&label=Latest&color=111111&labelColor=000000" alt="Latest release" /></a>
  <a href="https://github.com/TechyCSR/OpenCluely/releases"><img src="https://img.shields.io/github/downloads/TechyCSR/OpenCluely/total?style=for-the-badge&color=111111&labelColor=000000" alt="Downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-111111?style=for-the-badge&labelColor=000000" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux-111111?style=for-the-badge&labelColor=000000" alt="Platforms" />
</p>

<a href="https://opencluely.techycsr.dev"><b>Website</b></a> &nbsp;|&nbsp;
<a href="#download">Download</a> &nbsp;|&nbsp;
<a href="#quick-start">Quick start</a> &nbsp;|&nbsp;
<a href="#how-it-works">How it works</a>

</div>

## Demo

https://github.com/user-attachments/assets/896a7140-1e85-405d-bfbe-e05c9f3a816b

## What it is

OpenCluely is a desktop app for technical interviews and practice. It places a small overlay on your screen that recording and conferencing tools do not capture. You can speak a question or take a screenshot, and the AI answers in real time. The answer streams into a floating window and an optional chat panel, with clean code blocks and syntax highlighting.

It is free and open source. Processing stays on your machine, and the only thing that leaves your device is the request you send to the AI provider.

## Highlights

- **Invisible overlay.** Windows stay out of Zoom, Google Meet, Microsoft Teams, Discord, and OBS captures. You see the answer, the call does not.
- **Hidden during screen share.** When a share starts, the app can hide every window on its own.
- **Computer audio capture.** Record the sound playing through your computer output, with manual start/stop or automatic voice-activity detection. The app never falls back to the default microphone.
- **Multiple AI providers.** Choose Gemini, OpenAI, an OpenAI-compatible endpoint, or Cloudflare Workers AI independently of the transcription provider.
- **Local or cloud Whisper.** Use local Whisper, Cloudflare Whisper / Whisper Large v3 Turbo, or Azure Speech for transcription.
- **Role-specific assistance.** DSA, DevOps, Analyst (product, data, business and systems), Backend dev, ML Engineer and AI Engineer, with Go alongside the existing coding languages.
- **Configurable streamed answers.** Route voice replies to chat, the floating overlay, or both.
- **Direct image analysis.** Screenshots go straight to Gemini for visual reasoning, with no slow OCR step in between.
- **Session memory.** The whole conversation is remembered, so follow-ups, edge cases, and optimizations keep their context.
- **Language aware.** Tailored answers for C++, C, Python, Java, and JavaScript.
- **Stealthy by design.** Runs under ordinary system names, ships with no telemetry, and keeps your session local.
- **Cross platform.** Pre-built installers for Windows and Linux (.deb and AppImage). macOS runs from source in one command.

## Download

Pre-built installers are published with every release. These links always point at the newest version.

| Platform | File | Notes |
|---|---|---|
| Windows | [Setup .exe](https://github.com/TechyCSR/OpenCluely/releases/latest) | NSIS installer. Adds a Start Menu shortcut. |
| Linux (Debian or Ubuntu) | [.deb](https://github.com/TechyCSR/OpenCluely/releases/latest) | Pulls system deps automatically (Python, ffmpeg, GTK). |
| Linux (universal) | [.AppImage](https://github.com/TechyCSR/OpenCluely/releases/latest) | No install. Run `chmod +x` then launch. |

> **macOS:** there is no pre-built download. The app is unsigned and un-notarized, so macOS Gatekeeper blocks it as "damaged and can't be opened." Run OpenCluely from source instead — see [Quick start](#quick-start). It is a one-line `./setup.sh` once Node.js is installed.

Every build is produced automatically on GitHub Actions and ships with SHA-256 checksums. Each release also lists the full set of commits it includes.

The website at [opencluely.techycsr.dev](https://opencluely.techycsr.dev) detects your operating system and offers the right installer directly.

## Quick start

If you would rather build from source, three steps are all it takes.

1. Clone the repository.

   ```bash
   git clone https://github.com/TechyCSR/OpenCluely.git
   cd OpenCluely
   ```

2. Run the setup script.

   ```bash
   ./setup.sh
   ```

   The script installs Node dependencies, creates your `.env` from the example, sets up a local Whisper virtual environment, points the config at it, and launches the app.

3. Configure your AI provider.

   On first launch the onboarding wizard opens. Choose Gemini, OpenAI / Compatible API, or Cloudflare Workers AI and enter the corresponding credentials. The same fields are available in Settings, and changes apply without a restart. Gemini keys are available from [Google AI Studio](https://aistudio.google.com/).

   For a direct source launch, including Windows PowerShell, use `npm ci` followed by `npm start`. `setup.sh` is optional when you want it to bootstrap local Whisper; Cloudflare Whisper needs no Python installation or local model download.

### Platform notes

- On Windows, use Git Bash (included with Git for Windows) or WSL to run `setup.sh`.
- On macOS and Linux, your normal terminal works.
- **macOS users must build from source** (steps above) — there is no pre-built `.dmg`. Because the app is unsigned, a downloaded build would be blocked by Gatekeeper as "damaged"; running from source avoids that entirely.
- No manual `npm` commands are needed. The script handles everything.

### Setup script options

```bash
./setup.sh --build                # Build a distributable for your OS
./setup.sh --ci                   # Use npm ci instead of npm install
./setup.sh --no-run               # Set up only, do not launch
./setup.sh --install-system-deps  # Legacy recorder bootstrap (optional)
./setup.sh --skip-whisper         # Skip the local Whisper bootstrap
```

## Configuration

The setup script writes defaults. Configure credentials for the selected AI provider; a Gemini key is only required when using Gemini. All provider fields can be edited in Settings.

```bash
# AI answers: gemini, openai, cloudflare
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Shared by Workers AI answers and Cloudflare Whisper
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
CLOUDFLARE_WHISPER_MODEL=@cf/openai/whisper

# Optional speech provider. Pick one.
SPEECH_PROVIDER=whisper

# Azure option
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_region

# Local Whisper option
WHISPER_COMMAND=whisper
WHISPER_MODEL_DIR=.whisper-models
WHISPER_MODEL=small
WHISPER_LANGUAGE=auto
WHISPER_DEVICE=auto
WHISPER_PYTHON=
WHISPER_CAPTURE_MODE=vad
WHISPER_RESPONSE_TARGET=both
WHISPER_MANUAL_MAX_MS=90000
WHISPER_GPU_IDLE_MS=60000

# UI preferences
CODING_LANGUAGE=go
ACTIVE_SKILL=backend
```

For Cloudflare, enter your 32-character Account ID and an API Token with Workers AI access. Select `Cloudflare Workers AI` for answers and/or `Cloudflare Whisper` for speech. These choices are independent: OpenAI answers can use Cloudflare transcription, and Cloudflare answers can use local Whisper. Cloudflare's token is separate from an OpenAI API key.

Cloudflare answers use its [OpenAI-compatible Chat Completions endpoint](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/). Transcription uses the [Whisper REST model](https://developers.cloudflare.com/workers-ai/models/whisper/) or [Whisper Large v3 Turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/). The default Cloudflare chat model is for text; choose a model with image support to analyze screenshots. Custom OpenAI-compatible base URLs must use HTTPS, except localhost endpoints.

Requests inside Electron use Chromium networking so the system proxy is respected. Gemma 4 on Workers AI uses `chat_template_kwargs.enable_thinking=false`, following the [Cloudflare example](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/), to avoid spending a short connection test entirely on hidden reasoning. Connection tests allow 1024 output tokens. API errors now show their HTTP status, provider code and a redacted explanation; chat clears its thinking indicator on failure.

To check the saved Cloudflare settings on Windows, run `node scripts/run-electron.js scripts/check-cloudflare-connection.js`. It tests ordinary and streamed requests using a fixed prompt, without printing credentials or sending conversation history. To use another configuration file, pass its path as the final argument. This manual check makes real API requests; it is separate from `npm test`.

Audio capture reads computer output. On Windows it uses system loopback and works with speakers or headphones. On Linux it records the default PulseAudio/PipeWire output monitor through `parec` (`pulseaudio-utils`). On macOS, the current Electron 29 runtime requires a virtual loopback device such as BlackHole: route system output to it and enter its exact audio input label in Settings (`SYSTEM_AUDIO_DEVICE`). If capture fails, the app reports an error without switching to a microphone.

Speech is optional. If no provider is configured, the audio capture button hides itself across the app.

## Optional voice setup

You can use local Whisper for offline transcription, Cloudflare Whisper without a local installation, or Azure Speech. Cloud speech providers receive the captured audio; local Whisper keeps transcription on your machine. Transcribed text is then sent to the selected AI provider for answers.

For local Whisper, `./setup.sh` handles the full setup. It creates `.venv-whisper`, installs `openai-whisper`, points `.env` at the virtual environment, creates `.whisper-models`, and runs a quick speech test. The app reads its own PCM WAV recordings directly; ffmpeg is only needed when transcribing other audio formats through the CLI fallback.

`WHISPER_DEVICE=auto` uses CUDA when the selected Python environment supports it,
otherwise CPU. Explicit `cpu` and `cuda` settings also apply to the CLI fallback;
CUDA failures are reported instead of silently switching to CPU. The local speech
connection test checks device selection and an actual CUDA computation, not just
`whisper --help`. It does not load the model or measure transcription accuracy.

Run the device probe with the **same Python interpreter as your configured Whisper
CLI**. The optional smoke check loads existing weights and transcribes synthetic
silence; it never records your audio or downloads model weights:

```powershell
$whisperPythonPath = '<your-whisper-venv>\Scripts\python.exe'
& $whisperPythonPath scripts/check-whisper-gpu.py --device cuda
& $whisperPythonPath scripts/check-whisper-gpu.py --device cuda --smoke --model small --model-dir '<existing-model-cache>'
& $whisperPythonPath tests/whisper_worker_test.py
```

On Windows, a plain Whisper installation may install CPU-only PyTorch. For Pascal
GPUs such as GTX 1060, use a wheel that still includes Pascal support. The
[PyTorch 2.14 support matrix](https://github.com/pytorch/pytorch/blob/main/RELEASE.md#pytorch-cuda-support-matrix)
lists it for CUDA 12.6; CUDA 13 builds do not include it. For Python 3.13 on Windows,
the [official CUDA 12.6 index](https://download.pytorch.org/whl/cu126/torch/)
contains the compatible `torch==2.14.1+cu126` wheel:

```powershell
& $whisperPythonPath -m pip install 'torch==2.14.1+cu126' --index-url https://download.pytorch.org/whl/cu126
```

Interview response style is shared in `prompts/_interview.md`, with expertise and
task-specific rules in each skill prompt. Typed, spoken, and screenshot questions
use the same short, natural response style. Full implementations are reserved for
coding tasks, and prompts do not invent personal experience. To manually inspect
three fixed sample answers with saved OpenAI/Cloudflare credentials, run
`node scripts/run-electron.js scripts/check-interview-prompts.js` (this sends real API requests).

For Azure Speech, create a Speech resource in the [Azure Portal](https://portal.azure.com/), then add the key and region to `.env` with `SPEECH_PROVIDER=azure`.

## How it works

1. **Ask.** Use automatic pause detection, choose manual start/stop capture in Settings, or use the screenshot shortcut.
2. **Reason.** The selected AI provider analyzes the transcription or screenshot using the active skill prompt. Text requests include recent conversation context.
3. **Answer.** Voice responses stream to chat, the overlay, or both, according to Settings.

## Keyboard shortcuts

| Action | Shortcut | Description |
|---|---|---|
| Screenshot capture | `Cmd/Ctrl + Shift + S` | Capture the screen and analyze it with Gemini |
| Toggle speech | `Alt + R` | Start or stop voice recognition, if configured |
| Toggle visibility | `Cmd/Ctrl + Shift + V` | Show or hide all windows |
| Toggle interaction | `Cmd/Ctrl + Shift + I` or `Alt + A` | Enable or disable click through |
| Open chat | `Cmd/Ctrl + Shift + C` | Open the interactive chat window |
| Settings | `Cmd/Ctrl + ,` | Open the settings panel |

## Project status

OpenCluely is under active development. The core is stable and improvements ship regularly.

### Done

- Stealth overlay with a draggable command bar and a click through toggle
- Hidden during screen share, with automatic hiding when a share begins
- Screenshot capture with direct Gemini analysis, no OCR step
- Configurable manual or VAD-driven voice capture
- Persistent local Whisper worker with optional CUDA acceleration and idle GPU release
- Configurable chat/overlay routing for streamed voice answers
- Whisper hallucination filter that drops phantom phrases on silence
- AI response window with markdown and syntax highlighting
- Global shortcuts for capture, visibility, interaction, chat, and settings
- Session memory and a full chat UI
- Language picker and a DSA skill prompt
- Optional Azure Speech and local Whisper, with an auto hiding mic button
- Multi-monitor and area capture support
- Window binding and positioning
- Settings management with disguise and stealth modes

### Planned

- Additional provider integrations beyond Gemini, OpenAI-compatible APIs and Cloudflare Workers AI
- Auto typing of code snippets into editors and IDEs
- Export of conversation history to markdown or PDF
- Deeper stealth, including process name randomization

## Troubleshooting

Development checks: `npm test` runs provider, settings and audio regression tests without real API credentials; `npm run check:syntax` checks JavaScript and inline scripts. `npm run test:ui` opens hidden Electron windows with mocked providers to validate the settings, onboarding and overlay. `node scripts/run-electron.js scripts/test-system-audio.js` probes Windows loopback and immediately releases its tracks without saving audio.

<details>
<summary>Setup issues</summary>

- **setup.sh will not run.** Make sure you are in the project folder (`cd OpenCluely`) and that the script is executable (`chmod +x setup.sh`). On Windows, use Git Bash.
- **Setup stops with exit code 130.** That means Ctrl+C was pressed. Run `./setup.sh` again.
- **Node or npm not found.** Install Node.js 18 or newer from [nodejs.org](https://nodejs.org/), restart the terminal, and retry.

</details>

<details>
<summary>App issues</summary>

- **Electron will not start or shows a blank window on Linux.** Try `npm run dev`, and make sure X11 or XWayland is available in headless setups.
- **macOS screen capture does not work.** Grant Screen Recording permission under System Settings, Privacy and Security, then relaunch the app.
- **Windows SmartScreen blocks the app.** Click More info, then Run anyway, or use `npm start` during development.
- **Computer audio not working.** Configure a transcription provider first. Windows captures the active system output; Linux requires `parec` and an available output monitor; macOS requires a routed virtual loopback input with its exact name in Settings. Cloudflare Whisper requires Workers AI credentials; local Whisper requires its Python environment. The app reports capture errors without switching to a microphone.

</details>

<details>

<summary> Limitations </summary>

- **Screen-capture invisibility does not work on Linux.** The overlay stays hidden from screen shares and recordings only on **macOS** and **Windows**. This relies on Electron's `setContentProtection`, which maps to `NSWindowSharingNone` on macOS and `WDA_EXCLUDEFROMCAPTURE` on Windows. Electron provides **no equivalent on Linux** (neither X11 nor Wayland), so on Linux the call is a silent no-op and the overlay **will be visible** to anyone you screen-share with. This is a platform limitation, not a bug — there is no window flag on Linux that excludes a window from framebuffer capture. If you need capture-invisibility, run OpenCluely on macOS or Windows. As a partial workaround on Linux, share a single application window instead of your entire screen, or place the overlay on a monitor you are not sharing.

</details>



## Privacy and ethics

OpenCluely collects no data and sends no telemetry. Processing happens locally, and your session stays on your device. Requests to the AI provider are encrypted in transit.

The app is built for learning and practice. You are responsible for following the rules of any interview you take and the policies of the companies involved.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- Google Gemini for the AI reasoning
- Azure Speech and OpenAI Whisper for optional voice input
- Electron for the cross platform desktop runtime
- [Vysper by varun-singhh](https://github.com/varun-singhh/Vysper) for UI and structure inspiration

<div align="center">

Built by [TechyCSR](https://techycsr.dev). If OpenCluely helped you, consider giving it a star ⭐

</div>
