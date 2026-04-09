/**
 * Manual repro / Issue #560 — tie **mic intent** (button or Live), **getUserMedia** grant, and **first binary WS send**
 * to proxy **`input_audio_buffer.commit`** (compare server log `debug.wall_clock_ms` or OTel `timestamp`).
 *
 * Enable: add query **`micTimingDebug=1`** (e.g. `http://localhost:5173/?micTimingDebug=1`).
 * After capture starts, check the Event Log line **`[micTimingDebug]`** and backend **`input_audio_buffer.commit`**.
 */

export type MicTimingDebugState = {
  userMicIntentAt?: number;
  startAudioCaptureEnteredAt?: number;
  startAudioCaptureCompletedAt?: number;
  gumCallCount: number;
  gumInvokedAt?: number;
  gumResolvedAt?: number;
  gumRejectedAt?: number;
  firstBinaryWsSendAt?: number;
  firstBinaryWsByteLength?: number;
};

declare global {
  interface Window {
    __micTimingDebug?: MicTimingDebugState;
  }
}

const STORAGE_KEY = '__micTimingDebugInstalled';

let origGetUserMedia: typeof navigator.mediaDevices.getUserMedia | null = null;
let origWebSocket: typeof WebSocket | null = null;

function ensureState(): MicTimingDebugState {
  const w = globalThis as Window & typeof globalThis;
  if (!w.__micTimingDebug) {
    w.__micTimingDebug = { gumCallCount: 0 };
  }
  return w.__micTimingDebug;
}

/** True when URL has `?micTimingDebug=1` (before install). */
export function isMicTimingDebugEnabled(): boolean {
  try {
    if (typeof globalThis.location === 'undefined') return false;
    return new URLSearchParams(globalThis.location.search).get('micTimingDebug') === '1';
  } catch {
    return false;
  }
}

function isMicTimingDebugActive(): boolean {
  const g = globalThis as typeof globalThis & { [STORAGE_KEY]?: boolean };
  return g[STORAGE_KEY] === true;
}

/**
 * Call once at app startup (`main.tsx`). Patches `getUserMedia` and `WebSocket` when enabled.
 */
export function installMicTimingDebug(options?: { force?: boolean }): void {
  const enabled = options?.force === true || isMicTimingDebugEnabled();
  if (!enabled) return;

  const g = globalThis as typeof globalThis & { [STORAGE_KEY]?: boolean };
  if (g[STORAGE_KEY]) return;
  g[STORAGE_KEY] = true;

  const md = navigator.mediaDevices;
  if (md && typeof md.getUserMedia === 'function' && !origGetUserMedia) {
    origGetUserMedia = md.getUserMedia.bind(md);
    md.getUserMedia = function micTimingDebugGUM(constraints) {
      const st = ensureState();
      st.gumCallCount += 1;
      st.gumInvokedAt = Date.now();
      return origGetUserMedia!.call(this, constraints).then(
        (stream) => {
          ensureState().gumResolvedAt = Date.now();
          return stream;
        },
        (err) => {
          ensureState().gumRejectedAt = Date.now();
          throw err;
        }
      );
    };
  }

  const OW = g.WebSocket;
  if (typeof OW === 'function' && !origWebSocket) {
    origWebSocket = OW;
    function WrappedWebSocket(
      this: unknown,
      url: string | URL,
      protocols?: string | string[]
    ): WebSocket {
      const ws =
        protocols !== undefined ? new OW(url, protocols) : new OW(url);
      const origSend = ws.send.bind(ws);
      ws.send = function micTimingDebugSend(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (data instanceof ArrayBuffer && data.byteLength > 0) {
          const st = ensureState();
          if (st.firstBinaryWsSendAt === undefined) {
            st.firstBinaryWsSendAt = Date.now();
            st.firstBinaryWsByteLength = data.byteLength;
          }
        }
        return origSend(data as never);
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
    g.WebSocket = WrappedWebSocket as unknown as typeof WebSocket;
  }
}

/** Tests only: undo patches and clear install flag. */
export function resetMicTimingDebugForTests(): void {
  const g = globalThis as typeof globalThis & { [STORAGE_KEY]?: boolean };
  g[STORAGE_KEY] = false;
  if (origGetUserMedia && navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = origGetUserMedia;
    origGetUserMedia = null;
  }
  if (origWebSocket) {
    g.WebSocket = origWebSocket;
    origWebSocket = null;
  }
  const w = g as unknown as Window;
  delete w.__micTimingDebug;
}

export function recordUserMicIntent(): void {
  if (!isMicTimingDebugActive()) return;
  ensureState().userMicIntentAt = Date.now();
}

export function recordStartAudioCaptureEntered(): void {
  if (!isMicTimingDebugActive()) return;
  ensureState().startAudioCaptureEnteredAt = Date.now();
}

export function recordStartAudioCaptureCompleted(): void {
  if (!isMicTimingDebugActive()) return;
  ensureState().startAudioCaptureCompletedAt = Date.now();
}

/** JSON line for Event Log; no-op if debug off or state missing. */
export function formatMicTimingDebugLine(): string | null {
  if (!isMicTimingDebugActive()) return null;
  const w = globalThis as Window & typeof globalThis;
  const d = w.__micTimingDebug;
  if (!d) return null;

  const delta = (a?: number, b?: number) =>
    a != null && b != null ? b - a : undefined;

  const payload = {
    userMicIntentAt: d.userMicIntentAt,
    startAudioCaptureEnteredAt: d.startAudioCaptureEnteredAt,
    startAudioCaptureCompletedAt: d.startAudioCaptureCompletedAt,
    gumInvokedAt: d.gumInvokedAt,
    gumResolvedAt: d.gumResolvedAt,
    gumRejectedAt: d.gumRejectedAt,
    gumCallCount: d.gumCallCount,
    firstBinaryWsSendAt: d.firstBinaryWsSendAt,
    firstBinaryWsByteLength: d.firstBinaryWsByteLength,
    deltasMs: {
      intentToGumInvoke: delta(d.userMicIntentAt, d.gumInvokedAt),
      gumInvokeToGumResolve: delta(d.gumInvokedAt, d.gumResolvedAt),
      intentToFirstBinary: delta(d.userMicIntentAt, d.firstBinaryWsSendAt),
      captureEnterToGumResolve: delta(d.startAudioCaptureEnteredAt, d.gumResolvedAt),
      gumResolveToFirstBinary: delta(d.gumResolvedAt, d.firstBinaryWsSendAt),
      captureDoneToFirstBinary: delta(d.startAudioCaptureCompletedAt, d.firstBinaryWsSendAt),
    },
  };
  return `[micTimingDebug] ${JSON.stringify(payload)}`;
}

/**
 * Emit one or more Event Log lines so **`firstBinaryWsSendAt`** appears after the worklet starts (often > 0 ms after `startAudioCapture` resolves).
 */
export function logMicTimingDebugProgress(addLog: (msg: string) => void): void {
  if (!isMicTimingDebugActive()) return;
  let last = '';
  const once = (tag: string) => {
    const line = formatMicTimingDebugLine();
    if (!line || line === last) return;
    last = line;
    addLog(tag ? `${line} ${tag}` : line);
  };
  once('');
  setTimeout(() => once('(t+600ms)'), 600);
  setTimeout(() => once('(t+2500ms)'), 2500);
}
