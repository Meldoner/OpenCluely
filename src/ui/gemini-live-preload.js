const { ipcRenderer } = require('electron');
let socket;
let closing = false;
let messages = Promise.resolve();
const report = (type, data) => ipcRenderer.send('gemini-live-event', type, data);

ipcRenderer.once('gemini-live-connect', (_event, url) => {
  if (closing) return;
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'wss:' || endpoint.hostname !== 'generativelanguage.googleapis.com' ||
      endpoint.pathname !== '/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent') return;
  socket = new WebSocket(url);
  socket.onopen = () => { if (closing) socket.close(1000); else report('open'); };
  socket.onmessage = event => {
    // Blob decoding is asynchronous: preserve server message ordering.
    messages = messages.then(async () => {
      const text = typeof event.data === 'string' ? event.data : await event.data.text();
      const message = JSON.parse(text);
      // This application displays the transcript and never plays generated audio.
      if (message.serverContent?.modelTurn?.parts) {
        message.serverContent.modelTurn.parts = message.serverContent.modelTurn.parts.filter(part => !part.inlineData);
      }
      if (!closing) report('message', message);
    }).catch(() => report('error', 'Invalid Live API message'));
  };
  socket.onerror = () => { if (!closing) report('error', 'Live WebSocket connection failed; check the network, proxy and API key'); };
  socket.onclose = event => { messages.then(() => report('close', event.code)); };
});
ipcRenderer.on('gemini-live-send', (_event, message) => {
  if (closing) return;
  if (!socket || socket.readyState !== WebSocket.OPEN) { report('error', 'Live socket is not open'); return; }
  if (socket.bufferedAmount > 1024 * 1024) { report('error', 'Live connection cannot keep up with audio'); return; }
  socket.send(message);
});
ipcRenderer.on('gemini-live-close', () => {
  if (closing) return;
  closing = true;
  if (!socket || socket.readyState === WebSocket.CLOSED) report('close', 1000);
  else if (socket.readyState !== WebSocket.CLOSING) socket.close(1000, 'Session complete');
});
window.addEventListener('unload', () => { if (socket) socket.close(); });
