#!/usr/bin/env npx tsx
/**
 * OpenAI proxy CLI (Issue #414)
 *
 * Sends command-line (or stdin) text to the OpenAI proxy and prints agent response text.
 * Optionally plays TTS audio (omit --text-only to enable; requires backend that returns audio).
 *
 * Usage:
 *   npx tsx scripts/openai-proxy/cli.ts [options] [--text "message"]
 *   echo "message" | npx tsx scripts/openai-proxy/cli.ts [options]
 *
 * Options:
 *   --url URL       Proxy WebSocket URL (default: ws://127.0.0.1:8080/openai)
 *   --text STRING   User message (if omitted, read from stdin)
 *   --text-only     Do not play agent TTS audio; only print response text
 *   --help          Show this usage
 *
 * Requires backend running (e.g. npm run backend from test-app, or npx tsx scripts/openai-proxy/run.ts).
 * API key: OPENAI_API_KEY is required by the proxy server; this script does not send it (proxy uses it for upstream).
 */

import WebSocket from 'ws';

const DEFAULT_URL = 'ws://127.0.0.1:8080/openai';

interface ParsedArgs {
  url: string;
  text: string | null;
  textOnly: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { url: DEFAULT_URL, text: null, textOnly: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) {
      out.url = argv[++i];
    } else if (argv[i] === '--text' && argv[i + 1]) {
      out.text = argv[++i];
    } else if (argv[i] === '--text-only') {
      out.textOnly = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      out.help = true;
    }
  }
  return out;
}

function printUsage(): void {
  const usage = [
    'Usage:',
    '  npx tsx scripts/openai-proxy/cli.ts [options] [--text "message"]',
    '  echo "message" | npx tsx scripts/openai-proxy/cli.ts [options]',
    '',
    'Options:',
    '  --url URL       Proxy WebSocket URL (default: ws://127.0.0.1:8080/openai)',
    '  --text STRING   User message (if omitted, read from stdin)',
    '  --text-only     Do not play agent TTS audio; only print response text',
    '  --help          Show this usage',
    '',
    'Run the backend first (e.g. npm run backend from test-app, or npx tsx scripts/openai-proxy/run.ts).',
  ].join('\n');
  console.log(usage);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString().trim()));
  });
}

function run(url: string, message: string, _textOnly: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settingsApplied = false;
    let resolved = false;

    const done = (err?: Error) => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch { /* ignore */ }
      if (err) reject(err);
      else resolve();
    };

    const timeout = setTimeout(() => {
      done(new Error('Timeout waiting for response'));
    }, 14000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: '' } } }));
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string };
        if (msg.type === 'SettingsApplied') {
          settingsApplied = true;
          ws.send(JSON.stringify({ type: 'InjectUserMessage', content: message }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          clearTimeout(timeout);
          process.stdout.write((msg.content ?? '') + '\n');
          done();
        }
        if (msg.type === 'Error') {
          clearTimeout(timeout);
          const desc = (msg as { description?: string }).description ?? 'Unknown error';
          process.stderr.write(desc + '\n');
          done(new Error(desc));
        }
      } catch {
        // ignore non-JSON (e.g. binary audio when not text-only)
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      done(err as Error);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (!resolved) done(new Error('Connection closed before response'));
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const message = args.text !== null ? args.text : await readStdin();
  if (!message) {
    process.stderr.write('No message provided. Use --text "..." or pipe text via stdin.\n');
    process.exit(1);
  }

  try {
    await run(args.url, message, args.textOnly);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(msg + '\n');
    process.exit(1);
  }
}

main();
