const path = require('path');
const { EventEmitter } = require('events');

// Chromium WebSocket uses the OS proxy. Keep credentials in an isolated preload,
// with no API exposed to the page and standard TLS verification in this session.
class GeminiLiveTransport extends EventEmitter {
  start(url) {
    const { BrowserWindow, ipcMain, session } = require('electron');
    const networkSession = session.fromPartition('gemini-live');
    networkSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    networkSession.setPermissionCheckHandler(() => false);
    this.window = new BrowserWindow({ show: false, skipTaskbar: true, webPreferences: {
      preload: path.join(__dirname, '../ui/gemini-live-preload.js'),
      session: networkSession, nodeIntegration: false, contextIsolation: true,
      sandbox: true, backgroundThrottling: false
    } });
    this.window.setContentProtection(true);
    this.receive = (event, type, data) => {
      if (event.sender !== this.window?.webContents || event.senderFrame !== this.window.webContents.mainFrame) return;
      if (type === 'message') {
        if (!data || typeof data !== 'object' || Array.isArray(data)) { this.emit('error', 'Invalid Live message'); return; }
        this.emit(type, data);
      } else if (type === 'open' || type === 'error' || (type === 'close' && Number.isInteger(data))) this.emit(type, data);
    };
    ipcMain.on('gemini-live-event', this.receive);
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('will-navigate', event => event.preventDefault());
    this.window.webContents.once('render-process-gone', () => this.emit('error', 'Live transport stopped'));
    this.window.once('closed', () => {
      this.window = null;
      ipcMain.removeListener('gemini-live-event', this.receive);
      this.emit('close', 1006);
    });
    this.window.loadFile(path.join(__dirname, '../ui/gemini-live.html')).then(() => {
      if (this.window && !this.window.isDestroyed()) this.window.webContents.send('gemini-live-connect', url);
    }).catch(() => { if (this.window) this.emit('error', 'Could not load Live transport'); });
  }

  send(message) {
    if (!this.window || this.window.isDestroyed()) throw new Error('Live transport is closed');
    this.window.webContents.send('gemini-live-send', JSON.stringify(message));
  }

  close() {
    const { ipcMain } = require('electron');
    if (this.receive) ipcMain.removeListener('gemini-live-event', this.receive);
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null;
  }
}

module.exports = GeminiLiveTransport;
