/**
 * OpenAI Realtime proxy – WebSocket server (Issue #381)
 *
 * Listens on a path (e.g. /openai); accepts component protocol (Settings, InjectUserMessage);
 * translates to OpenAI Realtime and forwards to upstream; translates upstream events back to component.
 * See docs/issues/ISSUE-381/API-DISCONTINUITIES.md.
 */

import http from 'http';
import path from 'path';
// Use require so we get CJS WebSocket; Server is on WebSocket.Server in ws/index.js
// Under Jest/ts-jest the default export may not have .Server, so load Server from lib
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws') as typeof import('ws');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = (WebSocket.Server && typeof WebSocket.Server === 'function')
  ? WebSocket.Server
  : require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));
import {
  mapSettingsToSessionUpdate,
  mapInjectUserMessageToConversationItemCreate,
  mapSessionUpdatedToSettingsApplied,
  mapOutputTextDoneToConversationText,
  mapOutputAudioTranscriptDoneToConversationText,
  mapErrorToComponentError,
  binaryToInputAudioBufferAppend,
} from './translator';

/** Debounce delay (ms) after last binary chunk before sending commit + response.create */
const INPUT_AUDIO_COMMIT_DEBOUNCE_MS = 200;

export interface OpenAIProxyServerOptions {
  /** HTTP server to attach WebSocket to (or we create one) */
  server?: http.Server;
  /** Path for WebSocket upgrade (e.g. '/openai') */
  path: string;
  /** Upstream OpenAI Realtime WebSocket URL (or mock) */
  upstreamUrl: string;
  /** Optional headers for upstream WebSocket (e.g. Authorization for OpenAI API) */
  upstreamHeaders?: Record<string, string>;
  /** Log connections and message types to stdout (set OPENAI_PROXY_DEBUG=1 when running) */
  debug?: boolean;
}

/**
 * Create and attach an OpenAI proxy WebSocket server.
 * Returns the WebSocketServer and the HTTP server (if created).
 */
export function createOpenAIProxyServer(options: OpenAIProxyServerOptions): {
  wss: InstanceType<typeof WebSocketServer>;
  server: http.Server;
} {
  const server =
    options.server ??
    http.createServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

  const wss = new WebSocketServer({ server, path: options.path });
  const debug = options.debug === true;

  wss.on('connection', (clientWs: WebSocket) => {
    if (debug) console.log('[openai-proxy] client connected');
    const upstream =
      options.upstreamHeaders && Object.keys(options.upstreamHeaders).length > 0
        ? new WebSocket(options.upstreamUrl, { headers: options.upstreamHeaders })
        : new WebSocket(options.upstreamUrl);
    const clientMessageQueue: Buffer[] = [];
    let audioCommitTimer: ReturnType<typeof setTimeout> | null = null;
    let hasPendingAudio = false;

    const scheduleAudioCommit = () => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      audioCommitTimer = setTimeout(() => {
        audioCommitTimer = null;
        if (hasPendingAudio && upstream.readyState === WebSocket.OPEN) {
          if (debug) console.log('[openai-proxy] client → upstream: input_audio_buffer.commit + response.create');
          upstream.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          upstream.send(JSON.stringify({ type: 'response.create' }));
          hasPendingAudio = false;
        }
      }, INPUT_AUDIO_COMMIT_DEBOUNCE_MS);
    };

    upstream.on('error', (err) => {
      if (debug) console.error('[openai-proxy] upstream error:', (err as Error).message);
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      clientWs.close();
    });
    upstream.on('close', (code, reason) => {
      if (debug) console.log('[openai-proxy] upstream closed', code, reason?.toString());
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
    });

    const forwardClientMessage = (raw: Buffer) => {
      if (raw.length === 0) return;
      try {
        const text = raw.toString('utf8');
        const msg = JSON.parse(text) as { type?: string; content?: string };
        if (debug) console.log('[openai-proxy] client → upstream:', msg.type || '(binary)');
        if (msg.type === 'Settings') {
          const sessionUpdate = mapSettingsToSessionUpdate(msg as Parameters<typeof mapSettingsToSessionUpdate>[0]);
          upstream.send(JSON.stringify(sessionUpdate));
        } else if (msg.type === 'InjectUserMessage') {
          const itemCreate = mapInjectUserMessageToConversationItemCreate(msg as Parameters<typeof mapInjectUserMessageToConversationItemCreate>[0]);
          upstream.send(JSON.stringify(itemCreate));
          upstream.send(JSON.stringify({ type: 'response.create' }));
        } else {
          upstream.send(raw);
        }
      } catch {
        if (raw.length > 0) {
          if (debug) console.log('[openai-proxy] client → upstream: input_audio_buffer.append');
          const appendEvent = binaryToInputAudioBufferAppend(raw);
          upstream.send(JSON.stringify(appendEvent));
          hasPendingAudio = true;
          scheduleAudioCommit();
        }
      }
    };

    clientWs.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (upstream.readyState !== WebSocket.OPEN) {
        clientMessageQueue.push(raw);
        return;
      }
      forwardClientMessage(raw);
    });

    upstream.on('open', () => {
      if (debug) console.log('[openai-proxy] upstream open');
      while (clientMessageQueue.length > 0) {
        const raw = clientMessageQueue.shift();
        if (raw) forwardClientMessage(raw);
      }
    });

    upstream.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      if (clientWs.readyState !== WebSocket.OPEN) return;
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      try {
        const text = raw.toString('utf8');
        const msg = JSON.parse(text) as {
          type?: string;
          text?: string;
          transcript?: string;
          error?: { message?: string; code?: string };
        };
        if (debug) console.log('[openai-proxy] upstream → client:', msg.type || '(binary)');
        if (msg.type === 'session.updated' || msg.type === 'session.created') {
          const settingsApplied = mapSessionUpdatedToSettingsApplied(msg as Parameters<typeof mapSessionUpdatedToSettingsApplied>[0]);
          clientWs.send(JSON.stringify(settingsApplied));
        } else if (msg.type === 'response.output_text.done') {
          const conversationText = mapOutputTextDoneToConversationText(msg as Parameters<typeof mapOutputTextDoneToConversationText>[0]);
          clientWs.send(JSON.stringify(conversationText));
        } else if (msg.type === 'response.output_audio_transcript.done') {
          const conversationText = mapOutputAudioTranscriptDoneToConversationText(
            msg as Parameters<typeof mapOutputAudioTranscriptDoneToConversationText>[0]
          );
          clientWs.send(JSON.stringify(conversationText));
        } else if (msg.type === 'error') {
          if (debug) console.error('[openai-proxy] upstream error event:', msg.error?.message ?? msg);
          const componentError = mapErrorToComponentError(msg as Parameters<typeof mapErrorToComponentError>[0]);
          clientWs.send(JSON.stringify(componentError));
        } else {
          clientWs.send(raw);
        }
      } catch {
        clientWs.send(raw);
      }
    });

    upstream.on('close', () => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      clientWs.close();
    });
    clientWs.on('close', () => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      upstream.close();
    });
    clientWs.on('error', () => upstream.close());
  });

  return { wss, server };
}
