/**
 * OpenAI proxy CLI integration tests (Issue #414)
 *
 * Starts a minimal WebSocket server that speaks the component protocol (Settings →
 * SettingsApplied; InjectUserMessage → ConversationText). Runs the CLI script
 * against it and asserts stdout and exit code. TDD: tests define expected behavior.
 *
 * @jest-environment node
 */

import http from 'http';
import path from 'path';
import { spawn } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));

const CLI_SCRIPT = path.resolve(__dirname, '../../scripts/openai-proxy/cli.ts');
const PROXY_PATH = '/openai';

function startMinimalProxyServer(): Promise<{ server: http.Server; port: number; wss: InstanceType<typeof WebSocketServer> }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    const wss = new WebSocketServer({ server, path: PROXY_PATH });
    wss.on('connection', (socket: import('ws')) => {
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
          if (msg.type === 'Settings') {
            socket.send(JSON.stringify({ type: 'SettingsApplied' }));
          }
          if (msg.type === 'InjectUserMessage') {
            // Echo user so CLI can optionally show it; then assistant reply
            socket.send(JSON.stringify({ type: 'ConversationText', role: 'user', content: msg.content ?? '' }));
            socket.send(JSON.stringify({ type: 'ConversationText', role: 'assistant', content: 'OK' }));
          }
        } catch {
          // ignore non-JSON
        }
      });
    });
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, port, wss });
    });
  });
}

function runCli(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', CLI_SCRIPT, ...args], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, OPENAI_API_KEY: 'test-key-not-used' },
      stdio: stdin !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    if (stdin !== undefined && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? null });
    });
  });
}

describe('OpenAI proxy CLI (Issue #414)', () => {
  let minimalProxy: { server: http.Server; port: number; wss: InstanceType<typeof WebSocketServer> } | null = null;

  beforeAll(async () => {
    minimalProxy = await startMinimalProxyServer();
  }, 10000);

  afterAll(async () => {
    if (minimalProxy) {
      minimalProxy.wss.close();
      await new Promise<void>((resolve) => minimalProxy!.server.close(() => resolve()));
    }
  }, 5000);

  it('takes text input from CLI (--text) and displays agent response text', async () => {
    expect(minimalProxy).not.toBeNull();
    const url = `ws://127.0.0.1:${minimalProxy!.port}${PROXY_PATH}`;
    const { stdout, code } = await runCli(['--url', url, '--text', 'hello', '--text-only']);

    expect(code).toBe(0);
    expect(stdout).toContain('OK');
    // stderr may contain npm/npx warnings from spawned process; script errors would also appear there
  }, 15000);

  it('takes text input from stdin and displays agent response text', async () => {
    expect(minimalProxy).not.toBeNull();
    const url = `ws://127.0.0.1:${minimalProxy!.port}${PROXY_PATH}`;
    const { stdout, code } = await runCli(['--url', url, '--text-only'], 'hi from stdin\n');

    expect(code).toBe(0);
    expect(stdout).toContain('OK');
  }, 15000);

  it('prints usage when --help is passed', async () => {
    const { stdout, stderr, code } = await runCli(['--help']);

    expect(code).toBe(0);
    expect(stdout + stderr).toMatch(/usage|Usage|--help|--url|--text/);
  }, 5000);

  it('when not --text-only, receives response.output_audio.delta/done and still prints agent text', async () => {
    // Server that sends OpenAI-style audio events then ConversationText (as real proxy would)
    const server = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    const wss = new WebSocketServer({ server, path: '/openai' });
    wss.on('connection', (socket: import('ws')) => {
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
          if (msg.type === 'Settings') {
            socket.send(JSON.stringify({ type: 'SettingsApplied' }));
          }
          if (msg.type === 'InjectUserMessage') {
            socket.send(JSON.stringify({ type: 'ConversationText', role: 'user', content: msg.content ?? '' }));
            // Send fake PCM chunk (base64) and done, then transcript (OpenAI proxy forwards these)
            const fakePcm = Buffer.alloc(320, 0).toString('base64'); // 10ms at 16kHz mono 16-bit
            socket.send(JSON.stringify({ type: 'response.output_audio.delta', delta: fakePcm }));
            socket.send(JSON.stringify({ type: 'response.output_audio.done' }));
            socket.send(JSON.stringify({ type: 'ConversationText', role: 'assistant', content: 'Heard you.' }));
          }
        } catch {
          // ignore
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    const url = `ws://127.0.0.1:${port}/openai`;
    const { stdout, code } = await runCli(['--url', url, '--text', 'hi']);

    expect(code).toBe(0);
    expect(stdout).toContain('Heard you.');
    wss.close();
    await new Promise<void>((r) => server.close(r));
  }, 15000);
});
