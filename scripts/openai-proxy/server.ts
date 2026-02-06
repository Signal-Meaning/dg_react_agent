/**
 * OpenAI Realtime proxy – WebSocket server (Issue #381)
 *
 * Listens on a path (e.g. /openai); accepts component protocol (Settings, InjectUserMessage);
 * translates to OpenAI Realtime and forwards to upstream; translates upstream events back to component.
 * Logging uses OpenTelemetry (see scripts/openai-proxy/logger.ts) when OPENAI_PROXY_DEBUG=1.
 * See docs/issues/ISSUE-381/API-DISCONTINUITIES.md.
 */

import http from 'http';
import type { Server as HttpsServer } from 'https';
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
  mapFunctionCallArgumentsDoneToFunctionCallRequest,
  mapFunctionCallArgumentsDoneToConversationText,
  mapFunctionCallResponseToConversationItemCreate,
  mapContextMessageToConversationItemCreate,
  mapGreetingToConversationItemCreate,
  mapGreetingToConversationText,
  mapErrorToComponentError,
  binaryToInputAudioBufferAppend,
} from './translator';
import {
  initProxyLogger,
  emitLog,
  SeverityNumber,
  ATTR_CONNECTION_ID,
  ATTR_DIRECTION,
  ATTR_MESSAGE_TYPE,
  ATTR_ERROR_CODE,
  ATTR_ERROR_MESSAGE,
  ATTR_UPSTREAM_CLOSE_CODE,
  ATTR_UPSTREAM_CLOSE_REASON,
} from './logger';

/** Debounce delay (ms) after last binary chunk before sending commit + response.create */
const INPUT_AUDIO_COMMIT_DEBOUNCE_MS = 200;

/** Connection counter for stable short ids in logs */
let connectionCounter = 0;

export interface OpenAIProxyServerOptions {
  /** HTTP or HTTPS server to attach WebSocket to (or we create one) */
  server?: http.Server | HttpsServer;
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
  server: http.Server | HttpsServer;
} {
  const server =
    options.server ??
    http.createServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

  const wss = new WebSocketServer({ server, path: options.path });
  const debug = options.debug === true;
  if (debug) initProxyLogger();

  wss.on('connection', (clientWs: WebSocket) => {
    const connId = `c${++connectionCounter}`;
    if (debug) {
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'client connected',
        attributes: { [ATTR_CONNECTION_ID]: connId, [ATTR_DIRECTION]: 'client' },
      });
    }
    const upstream =
      options.upstreamHeaders && Object.keys(options.upstreamHeaders).length > 0
        ? new WebSocket(options.upstreamUrl, { headers: options.upstreamHeaders })
        : new WebSocket(options.upstreamUrl);
    const clientMessageQueue: Buffer[] = [];
    let audioCommitTimer: ReturnType<typeof setTimeout> | null = null;
    let hasPendingAudio = false;
    /** Greeting from Settings; injected after session.updated (Issue #381) */
    let storedGreeting: string | undefined;
    /** Issue #388: send response.create only after upstream sends conversation.item.added or conversation.item.done */
    let pendingResponseCreateAfterItemAdded = false;
    /** Issue #406: have we sent SettingsApplied to the client? Used to send clear Error when upstream closes before session ready. */
    let hasSentSettingsApplied = false;
    /** Issue #406: defer context (conversation.item.create) until after session.updated to avoid upstream close. */
    const pendingContextItems: string[] = [];

    const scheduleAudioCommit = () => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      audioCommitTimer = setTimeout(() => {
        audioCommitTimer = null;
        if (hasPendingAudio && upstream.readyState === WebSocket.OPEN) {
          if (debug) {
            emitLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: 'input_audio_buffer.commit + response.create',
              attributes: { [ATTR_CONNECTION_ID]: connId, [ATTR_DIRECTION]: 'client→upstream' },
            });
          }
          upstream.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          upstream.send(JSON.stringify({ type: 'response.create' }));
          hasPendingAudio = false;
        }
      }, INPUT_AUDIO_COMMIT_DEBOUNCE_MS);
    };

    upstream.on('error', (err) => {
      if (debug) {
        emitLog({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: (err as Error).message,
          attributes: {
            [ATTR_CONNECTION_ID]: connId,
            [ATTR_DIRECTION]: 'upstream',
            [ATTR_ERROR_MESSAGE]: (err as Error).message,
          },
        });
      }
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      clientWs.close();
    });
    upstream.on('close', (code, reason) => {
      if (debug) {
        emitLog({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'upstream closed',
          attributes: {
            [ATTR_CONNECTION_ID]: connId,
            [ATTR_DIRECTION]: 'upstream',
            [ATTR_UPSTREAM_CLOSE_CODE]: code,
            [ATTR_UPSTREAM_CLOSE_REASON]: reason?.toString() ?? '',
          },
        });
      }
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
    });

    const forwardClientMessage = (raw: Buffer) => {
      if (raw.length === 0) return;
      try {
        const text = raw.toString('utf8');
        const msg = JSON.parse(text) as { type?: string; content?: string };
        if (debug) {
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'client → upstream',
            attributes: {
              [ATTR_CONNECTION_ID]: connId,
              [ATTR_DIRECTION]: 'client→upstream',
              [ATTR_MESSAGE_TYPE]: msg.type ?? '(binary)',
            },
          });
        }
        if (msg.type === 'Settings') {
          const settings = msg as Parameters<typeof mapSettingsToSessionUpdate>[0];
          const sessionUpdate = mapSettingsToSessionUpdate(settings);
          upstream.send(JSON.stringify(sessionUpdate));
          const contextMessages = settings.agent?.context?.messages;
          if (contextMessages?.length) {
            for (const m of contextMessages) {
              const role = (m.role === 'user' || m.role === 'assistant') ? m.role : 'user';
              const itemCreate = mapContextMessageToConversationItemCreate(role, m.content ?? '');
              pendingContextItems.push(JSON.stringify(itemCreate));
            }
          }
          const g = settings.agent?.greeting;
          storedGreeting = typeof g === 'string' && g.trim().length > 0 ? g : undefined;
        } else if (msg.type === 'FunctionCallResponse') {
          const itemCreate = mapFunctionCallResponseToConversationItemCreate(
            msg as Parameters<typeof mapFunctionCallResponseToConversationItemCreate>[0]
          );
          upstream.send(JSON.stringify(itemCreate));
          upstream.send(JSON.stringify({ type: 'response.create' }));
        } else if (msg.type === 'InjectUserMessage') {
          const injectMsg = msg as Parameters<typeof mapInjectUserMessageToConversationItemCreate>[0];
          const itemCreate = mapInjectUserMessageToConversationItemCreate(injectMsg);
          upstream.send(JSON.stringify(itemCreate));
          // Issue #388: wait for conversation.item.added or conversation.item.done before response.create
          pendingResponseCreateAfterItemAdded = true;
          // Echo user message to client so the app can add it to conversationHistory (context on reconnect)
          const userEcho: { type: 'ConversationText'; role: 'user'; content: string } = {
            type: 'ConversationText',
            role: 'user',
            content: injectMsg.content ?? '',
          };
          clientWs.send(JSON.stringify(userEcho));
        } else {
          upstream.send(raw);
        }
      } catch {
        if (raw.length > 0) {
          if (debug) {
            emitLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: 'input_audio_buffer.append',
              attributes: {
                [ATTR_CONNECTION_ID]: connId,
                [ATTR_DIRECTION]: 'client→upstream',
                [ATTR_MESSAGE_TYPE]: 'input_audio_buffer.append',
              },
            });
          }
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
      if (debug) {
        emitLog({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'upstream open',
          attributes: { [ATTR_CONNECTION_ID]: connId, [ATTR_DIRECTION]: 'upstream' },
        });
      }
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
        if (debug) {
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'upstream → client',
            attributes: {
              [ATTR_CONNECTION_ID]: connId,
              [ATTR_DIRECTION]: 'upstream→client',
              [ATTR_MESSAGE_TYPE]: msg.type ?? '(binary)',
            },
          });
        }
        if (msg.type === 'session.updated' || msg.type === 'session.created') {
          hasSentSettingsApplied = true;
          for (const itemJson of pendingContextItems) {
            upstream.send(itemJson);
          }
          pendingContextItems.length = 0;
          const settingsApplied = mapSessionUpdatedToSettingsApplied(msg as Parameters<typeof mapSessionUpdatedToSettingsApplied>[0]);
          clientWs.send(JSON.stringify(settingsApplied));
          if (storedGreeting) {
            upstream.send(JSON.stringify(mapGreetingToConversationItemCreate(storedGreeting)));
            clientWs.send(JSON.stringify(mapGreetingToConversationText(storedGreeting)));
            if (debug) {
              emitLog({
                severityNumber: SeverityNumber.INFO,
                severityText: 'INFO',
                body: 'greeting injected',
                attributes: { [ATTR_CONNECTION_ID]: connId },
              });
            }
            storedGreeting = undefined;
          }
        } else if (msg.type === 'response.output_text.done') {
          const m = msg as { type: string; text?: string };
          if (debug || (m.text && m.text.trim().startsWith('Function call:'))) {
            console.log(`[proxy ${connId}] upstream→client: ${msg.type}${m.text?.startsWith('Function call:') ? ' (transcript-like)' : ''}`);
          }
          const conversationText = mapOutputTextDoneToConversationText(msg as Parameters<typeof mapOutputTextDoneToConversationText>[0]);
          clientWs.send(JSON.stringify(conversationText));
        } else if (msg.type === 'response.output_audio_transcript.done') {
          const m = msg as { type: string; transcript?: string };
          if (debug || (m.transcript && m.transcript.trim().startsWith('Function call:'))) {
            console.log(`[proxy ${connId}] upstream→client: ${msg.type}${m.transcript?.startsWith('Function call:') ? ' (transcript-like)' : ''}`);
          }
          const conversationText = mapOutputAudioTranscriptDoneToConversationText(
            msg as Parameters<typeof mapOutputAudioTranscriptDoneToConversationText>[0]
          );
          clientWs.send(JSON.stringify(conversationText));
        } else if (msg.type === 'response.function_call_arguments.done') {
          console.log(`[proxy ${connId}] upstream→client: ${msg.type} → sending FunctionCallRequest + ConversationText`);
          const functionCallRequest = mapFunctionCallArgumentsDoneToFunctionCallRequest(
            msg as Parameters<typeof mapFunctionCallArgumentsDoneToFunctionCallRequest>[0]
          );
          clientWs.send(JSON.stringify(functionCallRequest));
          const conversationText = mapFunctionCallArgumentsDoneToConversationText(
            msg as Parameters<typeof mapFunctionCallArgumentsDoneToConversationText>[0]
          );
          clientWs.send(JSON.stringify(conversationText));
        } else if (msg.type === 'error') {
          if (debug) {
            emitLog({
              severityNumber: SeverityNumber.ERROR,
              severityText: 'ERROR',
              body: msg.error?.message ?? String(msg),
              attributes: {
                [ATTR_CONNECTION_ID]: connId,
                [ATTR_DIRECTION]: 'upstream→client',
                [ATTR_MESSAGE_TYPE]: 'error',
                [ATTR_ERROR_CODE]: msg.error?.code ?? '',
                [ATTR_ERROR_MESSAGE]: msg.error?.message ?? '',
              },
            });
          }
          const componentError = mapErrorToComponentError(msg as Parameters<typeof mapErrorToComponentError>[0]);
          clientWs.send(JSON.stringify(componentError));
        } else if (msg.type === 'conversation.item.added' || msg.type === 'conversation.item.done') {
          // Issue #388: send response.create only after upstream confirms the item was added
          if (pendingResponseCreateAfterItemAdded) {
            pendingResponseCreateAfterItemAdded = false;
            upstream.send(JSON.stringify({ type: 'response.create' }));
          }
          clientWs.send(raw);
        } else {
          clientWs.send(raw);
        }
      } catch {
        clientWs.send(raw);
      }
    });

    upstream.on('close', (code: number, reason?: Buffer) => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      // Issue #406: if upstream closed before we sent SettingsApplied, notify the client so the host sees a clear error instead of only "connection closed"
      if (!hasSentSettingsApplied && clientWs.readyState === WebSocket.OPEN) {
        const reasonStr = reason && reason.length > 0 ? reason.toString() : '';
        const description = `Upstream closed before session ready (code ${code}${reasonStr ? `, reason: ${reasonStr}` : ''}). Session may not have been applied.`;
        try {
          clientWs.send(JSON.stringify({
            type: 'Error',
            description,
            code: 'upstream_closed_before_session_ready',
          }));
        } catch {
          // ignore send errors (client may already be closing)
        }
        if (debug) {
          emitLog({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: description,
            attributes: {
              [ATTR_CONNECTION_ID]: connId,
              [ATTR_UPSTREAM_CLOSE_CODE]: code,
              [ATTR_UPSTREAM_CLOSE_REASON]: reasonStr,
            },
          });
        }
      }
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
