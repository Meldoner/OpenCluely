// Windows-only capture API probe. Immediately releases tracks; saves no audio.
const { app, BrowserWindow, desktopCapturer, session } = require('electron');
const { configureSystemAudioSession } = require('../src/core/system-audio-session');

app.whenReady().then(async () => {
  if (process.platform !== 'win32') { console.log('Windows loopback probe skipped on this platform.'); app.exit(0); return; }
  const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  configureSystemAudioSession(session.defaultSession, desktopCapturer, () => window);
  session.defaultSession.setPermissionCheckHandler(contents => contents === window.webContents);
  session.defaultSession.setPermissionRequestHandler((contents, _permission, callback) => callback(contents === window.webContents));
  try {
    await window.loadFile(require('path').join(__dirname, '..', 'onboarding.html'));
    const result = await window.webContents.executeJavaScript(`(async () => {
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      const audioTracks = stream.getAudioTracks().length;
      stream.getTracks().forEach(track => track.stop());
      return { audioTracks };
    })()`, false);
    if (!result.audioTracks) throw new Error('No system audio track');
    console.log('Windows loopback capture succeeded without a renderer click; tracks released immediately.');
    app.exit(0);
  } catch (error) { console.error('Windows loopback probe:', error.message); app.exit(1); }
});
