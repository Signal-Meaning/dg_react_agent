/**
 * OpenAI proxy integration tests (Issue #381)
 *
 * Proxy as WebSocket server: real WebSocket connections, mock OpenAI upstream.
 * See docs/issues/ISSUE-381/INTEGRATION-TEST-PLAN.md.
 *
 * @jest-environment node
 */

import http from 'http';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws');
// Load WebSocketServer from ws package (Jest resolve may not expose ws/lib/*)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));
import {
  createOpenAIProxyServer,
} from '../../scripts/openai-proxy/server';

describe('OpenAI proxy integration (Issue #381)', () => {
  let mockUpstreamServer: http.Server;
  let mockWss: InstanceType<typeof WebSocketServer>;
  let mockPort: number;
  let proxyServer: http.Server;
  let proxyPort: number;
  const PROXY_PATH = '/openai';
  const mockReceived: Array<{ type: string }> = [];

  beforeAll(async () => {
    mockUpstreamServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => mockUpstreamServer.listen(0, () => resolve()));
    mockPort = (mockUpstreamServer.address() as { port: number }).port;
    mockWss = new WebSocketServer({ server: mockUpstreamServer });
    mockWss.on('connection', (socket: import('ws')) => {
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string };
          if (msg.type) mockReceived.push({ type: msg.type });
          if (msg.type === 'session.update') {
            socket.send(JSON.stringify({ type: 'session.updated', session: { type: 'realtime' } }));
          }
          if (msg.type === 'conversation.item.create') {
            // Proxy will send response.create next; mock replies when it gets response.create
          }
          if (msg.type === 'response.create') {
            socket.send(JSON.stringify({ type: 'response.output_text.done', text: 'Hello from mock' }));
          }
          if (msg.type === 'input_audio_buffer.commit') {
            socket.send(JSON.stringify({ type: 'input_audio_buffer.committed' }));
          }
        } catch {
          // ignore
        }
      });
    });

    proxyServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => proxyServer.listen(0, () => resolve()));
    proxyPort = (proxyServer.address() as { port: number }).port;
    createOpenAIProxyServer({
      server: proxyServer,
      path: PROXY_PATH,
      upstreamUrl: `ws://localhost:${mockPort}`,
    });
  });

  afterAll(async () => {
    if (mockWss) mockWss.close();
    if (mockUpstreamServer) mockUpstreamServer.close();
    if (proxyServer) await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
  }, 5000);

  it('listens on configured path and accepts WebSocket upgrade', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      expect(client.readyState).toBe(1); // OPEN
      client.close();
      done();
    });
    client.on('error', done);
  });

  it('translates Settings to session.update and session.updated to SettingsApplied', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Help.' } },
      }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        expect(msg.type).toBe('SettingsApplied');
        client.close();
        done();
      }
    });
    client.on('error', done);
  });

  it('translates InjectUserMessage to conversation.item.create + response.create and response.output_text.done to ConversationText', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let gotSettingsApplied = false;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
      if (msg.type === 'SettingsApplied') {
        gotSettingsApplied = true;
        client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'hi' }));
      }
      if (msg.type === 'ConversationText' && msg.role === 'assistant') {
        expect(msg.content).toBe('Hello from mock');
        client.close();
        done();
      }
    });
    client.on('error', done);
  });

  it('translates binary client message to input_audio_buffer.append and after debounce sends commit + response.create', (done) => {
    mockReceived.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        client.send(Buffer.from([0x00, 0x00, 0xff, 0xff]));
      }
      if (msg.type === 'ConversationText' && msg.role === 'assistant') {
        const types = mockReceived.map((m) => m.type);
        expect(types).toContain('input_audio_buffer.append');
        expect(types).toContain('input_audio_buffer.commit');
        expect(types).toContain('response.create');
        client.close();
        done();
      }
    });
    client.on('error', done);
  }, 5000);
});
