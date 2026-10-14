function configureSystemAudioSession(appSession, desktopCapturer, getMainWindow, platform = process.platform) {
  appSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const mainWindow = getMainWindow();
    if (platform !== 'win32' || !mainWindow || mainWindow.isDestroyed() ||
        request.frame !== mainWindow.webContents.mainFrame || !request.audioRequested) {
      callback({});
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
      callback(sources.length ? { video: sources[0], audio: 'loopback' } : {});
    } catch (_) { callback({}); }
  });
}

module.exports = { configureSystemAudioSession };
