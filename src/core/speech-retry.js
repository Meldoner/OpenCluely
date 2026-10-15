function isRetryableSpeechError(error) {
  if ([408, 425, 429].includes(error?.status) || (error?.status >= 500 && error.status <= 599)) return true;
  return /^(NETWORK_ERROR|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|LIVE_CONNECTION_LOST|LIVE_SETUP_TIMEOUT|ERR_(CONNECTION|NETWORK|INTERNET|PROXY))/.test(String(error?.code || ''));
}

function waitForSpeechRetry(attempt, signal, delayMs = Math.min(2000, 500 * 2 ** (attempt - 1))) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, delayMs);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

module.exports = { isRetryableSpeechError, waitForSpeechRetry };
