/**
 * Issue #560 / manual repro — correlate mic button, getUserMedia, first binary uplink.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  installMicTimingDebug,
  resetMicTimingDebugForTests,
  isMicTimingDebugEnabled,
  recordUserMicIntent,
} from '../../src/mic-timing-debug';

describe('mic-timing-debug', () => {
  const g = globalThis as typeof globalThis & {
    WebSocket: typeof WebSocket;
    __micTimingDebug?: Record<string, unknown>;
  };

  let origGUM: typeof navigator.mediaDevices.getUserMedia;
  let origWS: typeof WebSocket;
  let addedMediaDevices: boolean;

  beforeEach(() => {
    resetMicTimingDebugForTests();
    addedMediaDevices = false;
    if (!navigator.mediaDevices) {
      addedMediaDevices = true;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.reject(new Error('unmocked')),
        },
        configurable: true,
      });
    }
    origGUM = navigator.mediaDevices!.getUserMedia.bind(navigator.mediaDevices);
    origWS = g.WebSocket;

    class MockWS {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      url: string;
      constructor(url: string | URL, _protocols?: string | string[]) {
        this.url = String(url);
      }
      send(_data: unknown) {
        /* no-op */
      }
    }
    g.WebSocket = MockWS as unknown as typeof WebSocket;

    delete g.__micTimingDebug;
  });

  afterEach(() => {
    resetMicTimingDebugForTests();
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = origGUM;
    }
    if (addedMediaDevices) {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }
    g.WebSocket = origWS;
    delete g.__micTimingDebug;
  });

  it('does not patch when disabled', () => {
    installMicTimingDebug({ force: false });
    expect(isMicTimingDebugEnabled()).toBe(false);
    expect(g.__micTimingDebug).toBeUndefined();
  });

  it('installMicTimingDebug({ force: true }) records getUserMedia resolution order', async () => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.resolve({
        getTracks: () => [],
      } as unknown as MediaStream);

    installMicTimingDebug({ force: true });

    const before = Date.now();
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const d = g.__micTimingDebug!;
    expect(d.gumCallCount).toBe(1);
    expect(typeof d.gumInvokedAt).toBe('number');
    expect(typeof d.gumResolvedAt).toBe('number');
    expect((d.gumResolvedAt as number) >= before).toBe(true);
    expect((d.gumResolvedAt as number) >= (d.gumInvokedAt as number)).toBe(true);
  });

  it('records first WebSocket binary send timestamp', () => {
    installMicTimingDebug({ force: true });

    const WS = g.WebSocket;
    const ws = new WS('ws://localhost/');
    const buf = new ArrayBuffer(8);
    ws.send(buf);

    const d = g.__micTimingDebug!;
    expect(typeof d.firstBinaryWsSendAt).toBe('number');
    expect(d.firstBinaryWsByteLength).toBe(8);
  });

  it('recordUserMicIntent stamps when install is active', () => {
    installMicTimingDebug({ force: true });
    recordUserMicIntent();
    expect(typeof g.__micTimingDebug!.userMicIntentAt).toBe('number');
  });

  it('install is idempotent (single wrap)', async () => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.resolve({ getTracks: () => [] } as unknown as MediaStream);

    installMicTimingDebug({ force: true });
    installMicTimingDebug({ force: true });

    await navigator.mediaDevices.getUserMedia({ audio: true });
    await navigator.mediaDevices.getUserMedia({ audio: true });

    expect(g.__micTimingDebug!.gumCallCount).toBe(2);
  });
});
