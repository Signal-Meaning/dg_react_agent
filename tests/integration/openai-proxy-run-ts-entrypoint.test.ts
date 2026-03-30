/**
 * OpenAI proxy `run.ts` entrypoint integration (EPIC-546 / release qualification)
 *
 * Spawns the same CLI entry as test-app (`npx tsx scripts/openai-proxy/run.ts` with cwd =
 * `packages/voice-agent-backend`), with OPENAI_REALTIME_URL pointed at an in-process mock upstream.
 * Qualifies listen-tls resolution, dotenv loading, and createOpenAIProxyServer wiring on the
 * **recommended** path — not only the in-process `createOpenAIProxyServer` harness in
 * openai-proxy-integration.test.ts.
 *
 * Child env **sanitizes** OPENAI_PROXY_TLS_* / OPENAI_PROXY_INSECURE_DEV_TLS / HTTPS so a developer
 * .env (e.g. from test-app) cannot flip this test to HTTPS unexpectedly.
 *
 * @jest-environment node
 */

import http from 'http';
import net from 'net';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));

const BACKEND_PKG = path.resolve(__dirname, '../../packages/voice-agent-backend');
const PROXY_PATH = '/openai';
const MOCK_ASSISTANT_TEXT = 'Hello from mock';

/** Ephemeral TCP port on loopback only (not all interfaces). Used so `run.ts` can bind a chosen port without a fixed collision. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr && 'port' in addr ? (addr as net.AddressInfo).port : 0;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on('error', reject);
  });
}

/** Minimal OpenAI Realtime-shaped mock: session.update → session.updated; user item → .added; response.create → text path. */
function startMockUpstream(): Promise<{
  server: http.Server;
  port: number;
  wss: InstanceType<typeof WebSocketServer>;
}> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    const wss = new WebSocketServer({ server });
    wss.on('connection', (socket: import('ws')) => {
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            type?: string;
            item?: { role?: string; type?: string; content?: unknown[]; call_id?: string; output?: string };
          };
          if (msg.type === 'session.update') {
            socket.send(JSON.stringify({ type: 'session.updated', session: { type: 'realtime' } }));
          }
          if (msg.type === 'conversation.item.create') {
            const role = msg.item?.role;
            if (role === 'user') {
              socket.send(
                JSON.stringify({
                  type: 'conversation.item.added',
                  item: {
                    id: 'item_u_run_ts',
                    type: 'message',
                    status: 'completed',
                    role: 'user',
                    content: msg.item?.content ?? [{ type: 'input_text', text: 'hi' }],
                  },
                }),
              );
            }
          }
          if (msg.type === 'response.create') {
            socket.send(
              JSON.stringify({
                type: 'response.output_text.done',
                response_id: 'resp_run_ts',
                item_id: 'item_run_ts',
                output_index: 0,
                content_index: 0,
                text: MOCK_ASSISTANT_TEXT,
              }),
            );
            socket.send(
              JSON.stringify({
                type: 'conversation.item.done',
                item: {
                  id: 'item_mock_response_run_ts',
                  type: 'message',
                  status: 'completed',
                  role: 'assistant',
                  content: [{ type: 'output_text', text: MOCK_ASSISTANT_TEXT }],
                },
              }),
            );
          }
        } catch {
          // ignore
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null && 'port' in addr ? (addr as { port: number }).port : 0;
      if (port) resolve({ server, port, wss });
      else reject(new Error('mock upstream: no port'));
    });
    server.on('error', reject);
  });
}

function sanitizedRunTsEnv(mockPort: number, proxyPort: number): NodeJS.ProcessEnv {
  const e = { ...process.env };
  delete e.HTTPS;
  delete e.OPENAI_PROXY_TLS_KEY_PATH;
  delete e.OPENAI_PROXY_TLS_CERT_PATH;
  delete e.OPENAI_PROXY_INSECURE_DEV_TLS;
  e.OPENAI_API_KEY = 'sk-run-ts-entrypoint-mock';
  e.OPENAI_PROXY_PORT = String(proxyPort);
  e.OPENAI_REALTIME_URL = `ws://127.0.0.1:${mockPort}`;
  e.LOG_LEVEL = 'error';
  return e;
}

function spawnRunTsProxy(proxyPort: number, env: NodeJS.ProcessEnv): { child: ChildProcess; ready: Promise<void> } {
  let stderrBuf = '';
  const child = spawn('npx', ['tsx', 'scripts/openai-proxy/run.ts'], {
    cwd: BACKEND_PKG,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`run.ts did not become ready in 25s. stderr: ${stderrBuf.slice(-2000)}`));
    }, 25000);
    const onChunk = (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      if (/OpenAI proxy listening/i.test(stderrBuf) || /listening on http/i.test(stderrBuf)) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stderr?.on('data', onChunk);
    child.stdout?.on('data', onChunk);
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
    child.on('exit', (code, sig) => {
      if (settled) return;
      if (code !== 0 && code !== null) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`run.ts exited early code=${code} signal=${sig} stderr=${stderrBuf.slice(-2000)}`));
      }
    });
  });
  return { child, ready };
}

describe('OpenAI proxy run.ts entrypoint (test-app–aligned)', () => {
  jest.setTimeout(40000);

  let mockUpstream: { server: http.Server; port: number; wss: InstanceType<typeof WebSocketServer> } | null = null;
  let proxyPort = 0;
  let runChild: ChildProcess | null = null;

  beforeAll(async () => {
    mockUpstream = await startMockUpstream();
    proxyPort = await getFreePort();
    const env = sanitizedRunTsEnv(mockUpstream.port, proxyPort);
    const { child, ready } = spawnRunTsProxy(proxyPort, env);
    runChild = child;
    await ready;
  }, 35000);

  afterAll(async () => {
    if (runChild?.pid) {
      runChild.kill('SIGTERM');
      await new Promise<void>((r) => setTimeout(r, 500));
      if (runChild.exitCode === null) {
        try {
          runChild.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }
    }
    runChild = null;
    if (mockUpstream) {
      await new Promise<void>((resolve) => {
        mockUpstream!.wss.close(() => resolve());
      });
      await new Promise<void>((resolve) => mockUpstream!.server.close(() => resolve()));
      mockUpstream = null;
    }
  }, 10000);

  it('accepts WebSocket on /openai after run.ts start (mock upstream)', (done) => {
    const client = new WebSocket(`ws://127.0.0.1:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.close();
      done();
    });
    client.on('error', (err) => done(err));
  });

  it('Settings → SettingsApplied; InjectUserMessage → assistant ConversationText (mock upstream)', (done) => {
    const client = new WebSocket(`ws://127.0.0.1:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    let failTimer: ReturnType<typeof setTimeout>;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(failTimer);
      try {
        client.close();
      } catch {
        /* ignore */
      }
      if (err) done(err);
      else done();
    };
    failTimer = setTimeout(() => finish(new Error('timeout waiting for assistant ConversationText')), 15000);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string; description?: string };
        if (msg.type === 'Error') {
          finish(new Error(msg.description ?? 'Error from proxy'));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is 2 plus 2?' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          expect(typeof msg.content).toBe('string');
          expect(msg.content).toContain(MOCK_ASSISTANT_TEXT);
          finish();
        }
      } catch {
        // ignore parse errors
      }
    });
    client.on('error', (err) => finish(err));
  });
});
