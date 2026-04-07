/**
 * Issue #561 — Browser instrumentation for Playwright (via `page.addInitScript`, before `goto`).
 *
 * - Wraps `getUserMedia` to record calls and fulfillment (proves API ran successfully).
 * - Wraps `WebSocket.prototype.send` on each socket instance to count non-empty `ArrayBuffer` payloads
 *   (mic PCM uplink from the voice agent client).
 *
 * Playwright already launches Chromium with `--use-fake-device-for-media-stream` (see
 * `playwright.config.mjs`); the stream is synthetic but the real code path still runs.
 */
export function installMicE2eTelemetry() {
  const g = globalThis;
  if (g.__e2eMicTelemetryInstalled) return;
  g.__e2eMicTelemetryInstalled = true;
  g.__e2eGumCallCount = 0;
  g.__e2eGumResolved = false;
  g.__e2eGumRejected = false;
  g.__e2eWsBinarySendCount = 0;

  const md = navigator.mediaDevices;
  if (md && typeof md.getUserMedia === 'function') {
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = function (constraints) {
      g.__e2eGumCallCount++;
      return orig(constraints).then(
        (stream) => {
          g.__e2eGumResolved = true;
          return stream;
        },
        (err) => {
          g.__e2eGumRejected = true;
          throw err;
        }
      );
    };
  }

  const OW = g.WebSocket;
  function WrappedWebSocket(url, protocols) {
    const ws = protocols !== undefined ? new OW(url, protocols) : new OW(url);
    const origSend = ws.send.bind(ws);
    ws.send = function (data) {
      if (data instanceof ArrayBuffer && data.byteLength > 0) {
        g.__e2eWsBinarySendCount++;
      }
      return origSend(data);
    };
    return ws;
  }
  WrappedWebSocket.prototype = OW.prototype;
  Object.assign(WrappedWebSocket, {
    CONNECTING: OW.CONNECTING,
    OPEN: OW.OPEN,
    CLOSING: OW.CLOSING,
    CLOSED: OW.CLOSED,
  });
  g.WebSocket = WrappedWebSocket;
}
