/**
 * Unit tests for WebSocket capture logic used by E2E (installWebSocketCapture).
 *
 * Issue #489: E2E test 9a saw 3 WebSocket constructions but only 1 Settings message
 * captured — only the first socket's sends were in the array. This tests that:
 * - Constructor-only patching misses sends from sockets created via a cached original
 *   constructor (e.g. reconnects).
 * - Patching WebSocket.prototype.send captures sends from every instance regardless
 *   of which constructor was used. The E2E helper uses prototype patching.
 */

describe('WebSocket capture (E2E helper logic)', () => {
  /**
   * Apply the same capture pattern as installWebSocketCapture: patch the constructor
   * and wrap each instance's send to push to a shared array.
   */
  function applyConstructorOnlyCapture(win, OriginalWebSocket) {
    win.capturedSentMessages = [];
    win.__capturedWebSocketCount = 0;
    win.WebSocket = function (url, protocols) {
      win.__capturedWebSocketCount = (win.__capturedWebSocketCount || 0) + 1;
      const ws = new OriginalWebSocket(url, protocols);
      const originalSend = ws.send.bind(ws);
      ws.send = function (data) {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          win.capturedSentMessages.push({ type: parsed.type, data: parsed });
        } catch {
          win.capturedSentMessages.push({ type: 'binary', size: data?.byteLength ?? data?.length ?? 0 });
        }
        return originalSend(data);
      };
      return ws;
    };
  }

  /**
   * Capture that also patches WebSocket.prototype.send so that every WebSocket
   * (even those created via a cached original constructor) has sends captured.
   */
  function applyPrototypeCapture(win, OriginalWebSocket) {
    win.capturedSentMessages = [];
    win.__capturedWebSocketCount = 0;
    const OriginalSend = OriginalWebSocket.prototype.send;
    OriginalWebSocket.prototype.send = function (data) {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        win.capturedSentMessages.push({ type: parsed.type, data: parsed });
      } catch {
        win.capturedSentMessages.push({ type: 'binary', size: data?.byteLength ?? data?.length ?? 0 });
      }
      return OriginalSend.call(this, data);
    };
    win.WebSocket = function (url, protocols) {
      win.__capturedWebSocketCount = (win.__capturedWebSocketCount || 0) + 1;
      return new OriginalWebSocket(url, protocols);
    };
  }

  /** Mock WebSocket constructor: instances use prototype.send so prototype patching works. */
  function createMockWebSocketConstructor() {
    function MockWS() {
      this.readyState = 1;
    }
    MockWS.prototype.send = function () {};
    return MockWS;
  }

  test('constructor-only capture: all sends captured when all instances created via patched constructor', () => {
    const win = {};
    const MockWS = createMockWebSocketConstructor();
    applyConstructorOnlyCapture(win, MockWS);

    const ws1 = new win.WebSocket('ws://a');
    const ws2 = new win.WebSocket('ws://b');
    const ws3 = new win.WebSocket('ws://c');

    ws1.send(JSON.stringify({ type: 'Settings', agent: {} }));
    ws2.send(JSON.stringify({ type: 'Settings', agent: { context: { messages: [] } } }));
    ws3.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Hi' }));

    expect(win.__capturedWebSocketCount).toBe(3);
    expect(win.capturedSentMessages).toHaveLength(3);
    const settings = win.capturedSentMessages.filter((m) => m.type === 'Settings');
    expect(settings).toHaveLength(2);
    expect(win.capturedSentMessages[2].type).toBe('InjectUserMessage');
  });

  test('constructor-only capture: sends from sockets created via original constructor are NOT captured', () => {
    const win = {};
    const MockWS = createMockWebSocketConstructor();
    applyConstructorOnlyCapture(win, MockWS);

    const ws1 = new win.WebSocket('ws://a');
    ws1.send(JSON.stringify({ type: 'Settings', agent: {} }));

    // Simulate component holding a reference to the original constructor (e.g. at module load)
    const cachedOriginal = MockWS;
    const ws2 = new cachedOriginal('ws://b');
    ws2.send(JSON.stringify({ type: 'Settings', agent: { context: { messages: [{}] } } }));

    expect(win.__capturedWebSocketCount).toBe(1);
    expect(win.capturedSentMessages).toHaveLength(1);
    expect(win.capturedSentMessages[0].type).toBe('Settings');
    // ws2's send was never wrapped, so second Settings is missing — reproduces E2E bug
  });

  test('prototype capture: sends from all instances captured regardless of constructor', () => {
    const win = {};
    const MockWS = createMockWebSocketConstructor();
    applyPrototypeCapture(win, MockWS);

    const ws1 = new win.WebSocket('ws://a');
    const cachedOriginal = MockWS;
    const ws2 = new cachedOriginal('ws://b');
    const ws3 = new win.WebSocket('ws://c');

    ws1.send(JSON.stringify({ type: 'Settings', agent: {} }));
    ws2.send(JSON.stringify({ type: 'Settings', agent: { context: { messages: [{}] } } }));
    ws3.send(JSON.stringify({ type: 'Settings', agent: {} }));

    expect(win.__capturedWebSocketCount).toBe(2); // only win.WebSocket calls counted
    expect(win.capturedSentMessages).toHaveLength(3);
    const settings = win.capturedSentMessages.filter((m) => m.type === 'Settings');
    expect(settings).toHaveLength(3);
  });
});
