// Shared by application startup and the real Electron connection probe.
function configureNetworkSession(ses, platform = process.platform) {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('generativelanguage.googleapis.com')) {
      const platformUA = platform === 'darwin'
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.156 Safari/537.36'
        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.156 Safari/537.36';
      details.requestHeaders['User-Agent'] = platformUA;
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  ses.setCertificateVerifyProc((request, callback) => {
    if (request.hostname === 'generativelanguage.googleapis.com') {
      callback(0); // Preserve the existing Gemini certificate override.
    } else {
      // -3 delegates to Chromium's verification; -2 rejects the connection.
      // Delegate for both valid and invalid certificates, including proxy TLS.
      callback(-3);
    }
  });
}

module.exports = { configureNetworkSession };
