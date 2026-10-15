const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function transportFixture() {
  const ipcMain = new EventEmitter(), timers = new Map(), sent = [];
  let nextTimer = 0;
  class Window extends EventEmitter {
    constructor() {
      super();
      this.webContents = Object.assign(new EventEmitter(), {
        mainFrame: {}, send: (...args) => sent.push(args), setWindowOpenHandler() {}
      });
    }
    setContentProtection() {}
    loadFile() { return Promise.resolve(); }
    isDestroyed() { return !!this.destroyed; }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const context = { module: { exports: {} }, __dirname: path.join(__dirname, '../src/services'),
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: timer => timers.delete(timer),
    require: name => name === 'electron' ? { BrowserWindow: Window, ipcMain,
      session: { fromPartition: () => ({ setPermissionRequestHandler() {}, setPermissionCheckHandler() {} }) } } : require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/gemini-live-transport.js'), 'utf8'), context);
  const transport = new context.module.exports();
  transport.start('wss://example.invalid/');
  const window = transport.window;
  const report = (type, data) => ipcMain.emit('gemini-live-event', { sender: window.webContents, senderFrame: window.webContents.mainFrame }, type, data);
  return { transport, window, ipcMain, timers, sent, report };
}

test('Live transport waits for its own WebSocket close acknowledgement before destroying the renderer', async () => {
  const { transport, window, ipcMain, timers, sent, report } = transportFixture();
  const closes = [];
  transport.on('close', code => closes.push(code));
  await Promise.resolve();
  transport.close(); transport.close();
  assert.equal(window.isDestroyed(), false);
  assert.equal(sent.filter(([type]) => type === 'gemini-live-close').length, 1);
  assert.equal(timers.size, 1);
  ipcMain.emit('gemini-live-event', { sender: {}, senderFrame: {} }, 'close', 1000);
  assert.equal(window.isDestroyed(), false);
  assert.throws(() => transport.send({}), /closed/);
  report('close', 1000);
  assert.equal(window.isDestroyed(), true);
  assert.equal(timers.size, 0);
  assert.equal(ipcMain.listenerCount('gemini-live-event'), 0);
  assert.deepEqual(closes, []);
});

test('Live transport bounds cleanup if the closing renderer does not acknowledge', async () => {
  const { transport, window, ipcMain, timers, sent } = transportFixture();
  transport.close();
  await Promise.resolve();
  assert.equal(sent.some(([type]) => type === 'gemini-live-connect'), false);
  const timeout = [...timers.values()][0];
  timeout();
  assert.equal(window.isDestroyed(), true);
  assert.equal(timers.size, 0);
  assert.equal(ipcMain.listenerCount('gemini-live-event'), 0);
});
