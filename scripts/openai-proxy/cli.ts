#!/usr/bin/env npx tsx
/**
 * OpenAI proxy CLI (Issue #414)
 *
 * Sends command-line (or stdin) text to the OpenAI proxy and prints agent response text.
 * Optionally streams TTS audio to the system speaker (omit --text-only).
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
 * Audio: OpenAI Realtime sends PCM 24kHz mono 16-bit; the speaker package streams it to the default output device.
 *
 * Playback uses the shared IAudioPlaybackSink (src/utils/audio/AudioPlaybackSink.ts) with a Node implementation
 * (SpeakerSink in speaker-sink.ts). The test-app uses the same interface with WebAudioPlaybackSink (Web Audio API).
 */

import WebSocket from 'ws';
import type { IAudioPlaybackSink } from '../../src/utils/audio/AudioPlaybackSink';
import { createSpeakerSink } from './speaker-sink';

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

function run(url: string, message: string, textOnly: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let resolved = false;
    let audioSink: IAudioPlaybackSink | null = null;
    let receivedAnyAudioDelta = false;
    let waitingForSinkClose = false;

    if (!textOnly) {
      audioSink = createSpeakerSink();
      if (!audioSink) {
        process.stderr.write('Speaker not available; playing text only. (Install "speaker" and system audio deps if needed.)\n');
      }
    }

    const done = (err?: Error) => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch { /* ignore */ }
      if (audioSink) {
        try { audioSink.end(); } catch { /* ignore */ }
      }
      if (err) reject(err);
      else resolve();
    };

    const timeout = setTimeout(() => {
      done(new Error('Timeout waiting for response'));
    }, 20000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: '' } } }));
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type?: string;
          role?: string;
          content?: string;
          delta?: string;
          description?: string;
        };
        if (msg.type === 'SettingsApplied') {
          ws.send(JSON.stringify({ type: 'InjectUserMessage', content: message }));
        }
        if (msg.type === 'response.output_audio.delta' && msg.delta && audioSink) {
          receivedAnyAudioDelta = true;
          const buf = Buffer.from(msg.delta, 'base64');
          if (buf.length > 0) audioSink.write(buf);
        }
        if (msg.type === 'response.output_audio.done') {
          if (audioSink && receivedAnyAudioDelta) {
            waitingForSinkClose = true;
            audioSink.end(() => {
              if (waitingForSinkClose) {
                clearTimeout(timeout);
                done();
              }
            });
          } else {
            clearTimeout(timeout);
            done();
          }
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          process.stdout.write((msg.content ?? '') + '\n');
          if (!waitingForSinkClose && (!audioSink || !receivedAnyAudioDelta)) {
            clearTimeout(timeout);
            done();
          }
        }
        if (msg.type === 'Error') {
          clearTimeout(timeout);
          process.stderr.write((msg.description ?? 'Unknown error') + '\n');
          done(new Error(msg.description ?? 'Unknown error'));
        }
      } catch {
        // ignore non-JSON (e.g. binary)
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
