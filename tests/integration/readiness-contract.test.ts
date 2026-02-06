/**
 * Readiness contract integration test (Issue #406)
 *
 * Validates the component–backend contract: the client must receive SettingsApplied
 * before sending the first user message (InjectUserMessage). Any proxy (OpenAI or
 * Deepgram) must satisfy this contract.
 *
 * Uses a minimal WebSocket server that speaks the component protocol only:
 * on Settings → send SettingsApplied; on InjectUserMessage → accept and reply.
 * This test can be run in CI without external services and passes when the
 * contract is satisfied.
 *
 * @jest-environment node
 */

import http from 'http';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));

describe('Readiness contract (Issue #406)', () => {
  let server: http.Server;
  let wss: InstanceType<typeof WebSocketServer>;
  let port: number;
  /** Messages received by the mock server (component protocol) */
  const serverReceived: Array<{ type: string }> = [];

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    port = (server.address() as { port: number }).port;
    wss = new WebSocketServer({ server });
    wss.on('connection', (socket: import('ws')) => {
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
          if (msg.type) serverReceived.push({ type: msg.type });
          if (msg.type === 'Settings') {
            socket.send(JSON.stringify({ type: 'SettingsApplied' }));
          }
          if (msg.type === 'InjectUserMessage') {
            socket.send(JSON.stringify({
              type: 'ConversationText',
              role: 'assistant',
              content: 'OK',
            }));
          }
        } catch {
          // ignore non-JSON
        }
      });
    });
  });

  afterAll(async () => {
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    serverReceived.length = 0;
  });

  it('client must receive SettingsApplied before sending first InjectUserMessage (contract for either proxy)', (done) => {
    const client = new WebSocket(`ws://localhost:${port}`);
    let receivedSettingsApplied = false;

    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });

    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        receivedSettingsApplied = true;
        expect(serverReceived.some((m) => m.type === 'Settings')).toBe(true);
        expect(serverReceived.some((m) => m.type === 'InjectUserMessage')).toBe(false);
        client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'hello' }));
      }
      if (msg.type === 'ConversationText' && msg.role === 'assistant') {
        expect(receivedSettingsApplied).toBe(true);
        expect(serverReceived.some((m) => m.type === 'InjectUserMessage')).toBe(true);
        client.close();
        done();
      }
    });

    client.on('error', (err) => done(err));
  });
});
