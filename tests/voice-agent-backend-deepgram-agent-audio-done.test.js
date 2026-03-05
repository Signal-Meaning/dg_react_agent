/**
 * Issue #489: Deepgram proxy must send AgentAudioDone after first assistant ConversationText
 * only when we have already forwarded at least one binary (audio). If the greeting is
 * text-only (ConversationText before any binary), we do NOT send AgentAudioDone so the
 * component can use its text-only path (ConversationText → defer → idle).
 *
 * These tests assert the proxy's AgentAudioDone behavior by running a mock "Deepgram"
 * server and a client connected through the proxy.
 *
 * @jest-environment node
 */

const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

const attachUpgradePath = path.resolve(__dirname, '../packages/voice-agent-backend/src/attach-upgrade.js');
const { attachVoiceAgentUpgrade } = require(attachUpgradePath);

const DEEPGRAM_PATH = '/deepgram-proxy';
const CONVERSATION_TEXT_ASSISTANT = { type: 'ConversationText', role: 'assistant', content: 'Hello!' };

function createMockDeepgramServer() {
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true });
  let mockSocket = null;
  wss.on('connection', (ws) => {
    mockSocket = ws;
  });
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '';
    if (pathname === '/v1/agent/converse') {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    } else {
      socket.destroy();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({
        server,
        wss,
        url: `ws://127.0.0.1:${port}/v1/agent/converse`,
        sendFromDeepgram(data, isBinary = false) {
          if (mockSocket && mockSocket.readyState === WebSocket.OPEN) {
            mockSocket.send(data, { binary: isBinary });
          }
        },
        close: () => new Promise((r) => { server.close(r); }),
      });
    });
  });
}

function connectClient(proxyUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(proxyUrl, ['token', 'test-api-key']);
    const received = [];
    ws.on('message', (data, isBinary) => {
      try {
        const payload = isBinary ? data : JSON.parse(data.toString());
        received.push({ payload, isBinary, type: !isBinary && payload && payload.type ? payload.type : null });
      } catch {
        received.push({ payload: data, isBinary, type: null });
      }
    });
    ws.on('open', () => resolve({ ws, received }));
    ws.on('error', reject);
  });
}

describe('Deepgram proxy AgentAudioDone (Issue #489)', () => {
  let mockDeepgram;
  let proxyServer;
  let proxyShutdown;

  beforeAll(async () => {
    mockDeepgram = await createMockDeepgramServer();
    proxyServer = http.createServer();
    const { shutdown } = await attachVoiceAgentUpgrade(proxyServer, {
      deepgram: {
        path: DEEPGRAM_PATH,
        apiKey: 'test-key',
        agentUrl: mockDeepgram.url,
      },
    });
    proxyShutdown = shutdown;
    await new Promise((resolve) => proxyServer.listen(0, resolve));
  }, 15000);

  afterAll(async () => {
    if (proxyShutdown) await proxyShutdown();
    if (proxyServer) await new Promise((r) => proxyServer.close(r));
    if (mockDeepgram) await mockDeepgram.close();
  });

  it('does NOT send AgentAudioDone when first assistant message is ConversationText only (no binary)', async () => {
    const proxyPort = proxyServer.address().port;
    const clientUrl = `ws://127.0.0.1:${proxyPort}${DEEPGRAM_PATH}?service=agent`;
    const { ws, received } = await connectClient(clientUrl);

    // Wait for proxy to connect to mock Deepgram (proxy connects on client connection)
    await new Promise((r) => setTimeout(r, 200));

    mockDeepgram.sendFromDeepgram(JSON.stringify(CONVERSATION_TEXT_ASSISTANT), false);

    await new Promise((r) => setTimeout(r, 300));

    const hasConversationText = received.some((r) => r.type === 'ConversationText');
    const hasAgentAudioDone = received.some((r) => r.type === 'AgentAudioDone');

    ws.close();

    expect(hasConversationText).toBe(true);
    expect(hasAgentAudioDone).toBe(false);
  }, 5000);

  it('sends AgentAudioDone when binary was forwarded before first assistant ConversationText', async () => {
    const proxyPort = proxyServer.address().port;
    const clientUrl = `ws://127.0.0.1:${proxyPort}${DEEPGRAM_PATH}?service=agent`;
    const { ws, received } = await connectClient(clientUrl);

    await new Promise((r) => setTimeout(r, 200));

    // Send binary first (simulated audio chunk)
    mockDeepgram.sendFromDeepgram(Buffer.from([0, 1, 2, 3]), true);
    mockDeepgram.sendFromDeepgram(JSON.stringify(CONVERSATION_TEXT_ASSISTANT), false);

    await new Promise((r) => setTimeout(r, 300));

    const hasAgentAudioDone = received.some((r) => r.type === 'AgentAudioDone');

    ws.close();

    expect(hasAgentAudioDone).toBe(true);
  }, 5000);
});
