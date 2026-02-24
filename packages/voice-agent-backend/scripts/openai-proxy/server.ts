/**
 * OpenAI Realtime proxy – WebSocket server (Issue #381)
 *
 * Listens on a path (e.g. /openai); accepts component protocol (Settings, InjectUserMessage);
 * translates to OpenAI Realtime and forwards to upstream; translates upstream events back to component.
 * Logging uses OpenTelemetry (see logger.ts in this directory) when OPENAI_PROXY_DEBUG=1.
 * See docs/issues/ISSUE-381/API-DISCONTINUITIES.md.
 */

import http from 'http';
import type { Server as HttpsServer } from 'https';
import path from 'path';
// Use require so we get CJS WebSocket; Server is on WebSocket.Server in ws/index.js
// Under Jest/ts-jest the default export may not have .Server, so load Server from lib
/** Minimal type for ws WebSocket .on(); TS may infer DOM WebSocket which lacks .on(). */
type WsLike = { on(event: string, cb: (...args: any[]) => void): void };
type WsServerConstructor = new (options: object) => { on(event: string, cb: (...args: unknown[]) => void): void; close(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws') as typeof import('ws') & { Server: WsServerConstructor };
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
  mapGreetingToConversationText,
  mapErrorToComponentError,
  isIdleTimeoutClosure,
  isSessionMaxDurationError,
  binaryToInputAudioBufferAppend,
  mapInputAudioTranscriptionCompletedToTranscript,
  mapInputAudioTranscriptionDeltaToTranscript,
} from './translator';
import {
  initProxyLogger,
  emitLog,
  SeverityNumber,
  ATTR_CONNECTION_ID,
  ATTR_TRACE_ID,
  ATTR_DIRECTION,
  ATTR_MESSAGE_TYPE,
  ATTR_ERROR_CODE,
  ATTR_ERROR_MESSAGE,
  ATTR_UPSTREAM_CLOSE_CODE,
  ATTR_UPSTREAM_CLOSE_REASON,
} from './logger';
import { parse as parseUrl } from 'url';
import {
  OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT,
  assertMinAudioBeforeCommit,
  assertAppendChunkSize,
} from './openai-audio-constants';

/** Debounce delay (ms) after last binary chunk before sending commit + response.create. Must be long enough for upstream to process appends (real API returns "buffer too small ... 0.00ms" if commit is sent too soon). */
const INPUT_AUDIO_COMMIT_DEBOUNCE_MS = 400;

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
  /** Issue #437: Log level (debug | info | warn | error). Reads LOG_LEVEL in run.ts. */
  logLevel?: string;
  /**
   * TODO: Not expected to keep. When true, send greeting to client only (ConversationText for UI); do not send conversation.item.create (greeting) to upstream.
   * Use when upstream errors after greeting injection (e.g. OPENAI_PROXY_GREETING_TEXT_ONLY=1). Integration tests leave this false.
   */
  greetingTextOnly?: boolean;
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
  if (options.logLevel) {
    initProxyLogger({ logLevel: options.logLevel });
  }

  wss.on('connection', (clientWs: WebSocket, req: http.IncomingMessage) => {
    const connId = `c${++connectionCounter}`;
    // Issue #437 Phase 3: traceId from URL query for correlation; fallback to connId so every log has trace_id
    const traceIdFromQuery = (req?.url && parseUrl(req.url, true).query?.traceId) as string | undefined;
    const traceId = (typeof traceIdFromQuery === 'string' && traceIdFromQuery.trim() !== '')
      ? traceIdFromQuery.trim()
      : connId;
    const connectionAttrs: Record<string, string> = {
      [ATTR_CONNECTION_ID]: connId,
      [ATTR_TRACE_ID]: traceId,
    };
    emitLog({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'client connected',
      attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'client' },
    });
    // ws WebSocket constructor accepts (url, options?) with options.headers; TS typings may only show protocols
    const upstream =
      options.upstreamHeaders && Object.keys(options.upstreamHeaders).length > 0
        ? new WebSocket(options.upstreamUrl, { headers: options.upstreamHeaders } as unknown as ConstructorParameters<typeof WebSocket>[1])
        : new WebSocket(options.upstreamUrl);
    const clientMessageQueue: Buffer[] = [];
    let audioCommitTimer: ReturnType<typeof setTimeout> | null = null;
    let hasPendingAudio = false;
    /** Cumulative bytes sent via input_audio_buffer.append this connection; commit only when >= MIN_AUDIO_BYTES_FOR_COMMIT (Issue #414). */
    let pendingAudioBytes = 0;
    /** True after we send response.create until we receive response.output_text.done (Issue #414: avoid "conversation already has an active response"). */
    let responseInProgress = false;
    /** Greeting from Settings; injected after session.updated (Issue #381) */
    let storedGreeting: string | undefined;
    /**
     * Issue #388 / #414: send response.create after this many conversation.item events are confirmed.
     * Set to 1 for InjectUserMessage (one item). Set to N+1 for greeting with N context items.
     * Decremented once per unique item (tracked by pendingItemAckedIds) so that receiving both
     * .created/.added/.done for the same item only counts once.
     */
    let pendingItemAddedBeforeResponseCreate = 0;
    /** Issue #414: track item IDs already counted toward the pending counter to avoid double-decrement. */
    const pendingItemAckedIds = new Set<string>();
    /** Issue #406: have we sent SettingsApplied to the client? Used to send clear Error when upstream closes before session ready. */
    let hasSentSettingsApplied = false;
    /** Issue #406: defer context (conversation.item.create) until after session.updated to avoid upstream close. */
    const pendingContextItems: string[] = [];
    /** Issue #414: defer input_audio_buffer.append until after session.updated so session is configured for audio. */
    const pendingAudioQueue: Buffer[] = [];
    /** TODO: Not expected to keep. Only forward the first Settings per connection; duplicate Settings (e.g. on reconnect/reload) must not send a second session.update or upstream can error. */
    let hasForwardedSessionUpdate = false;
    /** Issue #462 / #470: After sending function_call_output, defer response.create until we receive response.output_text.done so the API can close the previous response first (avoids conversation_already_has_active_response). */
    let pendingResponseCreateAfterFunctionCallOutput = false;
    /** Issue #482: Have we sent AgentStartedSpeaking for the current response? So component sees "agent active" before ConversationText (avoids client idle timeout). Reset when response ends. */
    let hasSentAgentStartedSpeakingForCurrentResponse = false;
    /** Issue #482: Buffer idle_timeout Error and send after ConversationText so client can show assistant bubble before close. */
    let pendingIdleTimeoutError: { type: 'Error'; description: string; code: string } | null = null;
    /** Issue #414: TTS chunk boundary diagnostic (set OPENAI_PROXY_TTS_BOUNDARY_DEBUG=1 to log same format as test-app E2E). */
    let ttsChunkLengths: number[] = [];
    let lastTtsChunk: Buffer | null = null;
    const ttsBoundaryDebug = process.env.OPENAI_PROXY_TTS_BOUNDARY_DEBUG === '1';

    const scheduleAudioCommit = () => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      audioCommitTimer = setTimeout(() => {
        audioCommitTimer = null;
        if (
          hasPendingAudio &&
          pendingAudioBytes >= OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT &&
          !responseInProgress &&
          upstream.readyState === WebSocket.OPEN
        ) {
          assertMinAudioBeforeCommit(pendingAudioBytes);
          const bytesAtCommit = pendingAudioBytes;
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'input_audio_buffer.commit + response.create',
            attributes: {
              ...connectionAttrs,
              [ATTR_DIRECTION]: 'client→upstream',
              'audio.pending_bytes': bytesAtCommit,
            },
          });
          upstream.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          upstream.send(JSON.stringify({ type: 'response.create' }));
          responseInProgress = true;
          hasSentAgentStartedSpeakingForCurrentResponse = false; // Issue #482: new response
          hasPendingAudio = false;
          pendingAudioBytes = 0;
        }
      }, INPUT_AUDIO_COMMIT_DEBOUNCE_MS);
    };

    upstream.on('error', (err) => {
      emitLog({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: (err as Error).message,
        attributes: {
          ...connectionAttrs,
          [ATTR_DIRECTION]: 'upstream',
          [ATTR_ERROR_MESSAGE]: (err as Error).message,
        },
      });
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      clientWs.close();
    });
    upstream.on('close', (code, reason) => {
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'upstream closed',
        attributes: {
          ...connectionAttrs,
          [ATTR_DIRECTION]: 'upstream',
          [ATTR_UPSTREAM_CLOSE_CODE]: code,
          [ATTR_UPSTREAM_CLOSE_REASON]: reason?.toString() ?? '',
        },
      });
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
    });

    const forwardClientMessage = (raw: Buffer) => {
      if (raw.length === 0) return;
      try {
        const text = raw.toString('utf8');
        const msg = JSON.parse(text) as { type?: string; content?: string };
        emitLog({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'client → upstream',
          attributes: {
            ...connectionAttrs,
            [ATTR_DIRECTION]: 'client→upstream',
            [ATTR_MESSAGE_TYPE]: msg.type ?? '(binary)',
          },
        });
        if (msg.type === 'Settings') {
          if (hasForwardedSessionUpdate) {
            // Duplicate Settings (e.g. test-app reload/reconnect): do not send second session.update to upstream.
            // Send SettingsApplied so the client does not block waiting.
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify(mapSessionUpdatedToSettingsApplied()));
            }
            return;
          }
          // Issue #459 / #462: do not send session.update while upstream has an active response (avoids conversation_already_has_active_response).
          // Also block when we deferred response.create after function_call_output (Issue #470).
          if (responseInProgress || pendingResponseCreateAfterFunctionCallOutput) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify(mapSessionUpdatedToSettingsApplied()));
            }
            return;
          }
          hasForwardedSessionUpdate = true;
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
          // Issue #462 / #470: Do not send response.create here. The API still has the previous response
          // (the function-call request) active until it processes our function_call_output and sends
          // response.output_text.done. Sending response.create now triggers conversation_already_has_active_response.
          // Defer response.create until we receive that output_text.done (see output_text.done handler).
          pendingResponseCreateAfterFunctionCallOutput = true;
        } else if (msg.type === 'InjectUserMessage') {
          const injectMsg = msg as Parameters<typeof mapInjectUserMessageToConversationItemCreate>[0];
          const itemCreate = mapInjectUserMessageToConversationItemCreate(injectMsg);
          upstream.send(JSON.stringify(itemCreate));
          // Issue #388: wait for conversation.item.added before response.create (1 item: the user message)
          pendingItemAddedBeforeResponseCreate = 1;
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
          if (!hasSentSettingsApplied) {
            // Session not ready for audio yet; queue and send after session.updated (Issue #414).
            pendingAudioQueue.push(raw);
            emitLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: 'input_audio_buffer.append deferred (waiting for session.updated)',
              attributes: {
                ...connectionAttrs,
                [ATTR_DIRECTION]: 'client→upstream',
                'audio.queued_bytes': raw.length,
                'audio.queued_chunks': pendingAudioQueue.length,
              },
            });
            return;
          }
          assertAppendChunkSize(raw.length);
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'input_audio_buffer.append',
            attributes: {
              ...connectionAttrs,
              [ATTR_DIRECTION]: 'client→upstream',
              [ATTR_MESSAGE_TYPE]: 'input_audio_buffer.append',
            },
          });
          const appendEvent = binaryToInputAudioBufferAppend(raw);
          upstream.send(JSON.stringify(appendEvent));
          pendingAudioBytes += raw.length;
          hasPendingAudio = true;
          scheduleAudioCommit();
        }
      }
    };

    const flushPendingAudio = () => {
      while (pendingAudioQueue.length > 0) {
        const chunk = pendingAudioQueue.shift();
        if (!chunk || upstream.readyState !== WebSocket.OPEN) continue;
        assertAppendChunkSize(chunk.length);
        emitLog({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'input_audio_buffer.append (flushed after session.updated)',
          attributes: {
            ...connectionAttrs,
            [ATTR_DIRECTION]: 'client→upstream',
            [ATTR_MESSAGE_TYPE]: 'input_audio_buffer.append',
          },
        });
        const appendEvent = binaryToInputAudioBufferAppend(chunk);
        upstream.send(JSON.stringify(appendEvent));
        pendingAudioBytes += chunk.length;
        hasPendingAudio = true;
      }
      if (hasPendingAudio) scheduleAudioCommit();
    };

    (clientWs as unknown as WsLike).on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const raw = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (upstream.readyState !== WebSocket.OPEN) {
        clientMessageQueue.push(raw);
        return;
      }
      forwardClientMessage(raw);
    });

    (upstream as unknown as WsLike).on('open', () => {
      emitLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'upstream open',
        attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream' },
      });
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
          delta?: string;
          error?: { message?: string; code?: string };
        };
        emitLog({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'upstream → client',
          attributes: {
            ...connectionAttrs,
            [ATTR_DIRECTION]: 'upstream→client',
            [ATTR_MESSAGE_TYPE]: msg.type ?? '(binary)',
          },
        });
        if (msg.type === 'session.created') {
          // OpenAI sends session.created immediately on WebSocket connection, BEFORE
          // our session.update is processed. Do NOT inject context items or greeting
          // here — the session isn't configured yet. Sending conversation.item.create
          // before session.update is applied causes upstream errors (Issue #414).
          // Wait for session.updated (which confirms our session.update was applied).
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'session.created received (waiting for session.updated before injecting context/greeting)',
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client' },
          });
        } else if (msg.type === 'session.updated') {
          hasSentSettingsApplied = true;
          for (const itemJson of pendingContextItems) {
            upstream.send(itemJson);
          }
          pendingContextItems.length = 0;
          const settingsApplied = mapSessionUpdatedToSettingsApplied(msg as Parameters<typeof mapSessionUpdatedToSettingsApplied>[0]);
          clientWs.send(JSON.stringify(settingsApplied));
          if (storedGreeting) {
            // Issue #414 fix: greeting is text-only to client. Do NOT send conversation.item.create
            // (assistant) to upstream — OpenAI Realtime API errors on client-created assistant messages.
            // The greeting text is shown immediately in the UI; the model sees the greeting text in
            // its instructions (if configured) so it knows it already greeted the user.
            clientWs.send(JSON.stringify(mapGreetingToConversationText(storedGreeting)));
            emitLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: 'greeting sent to client only (not upstream; OpenAI Realtime rejects client-created assistant items)',
              attributes: { ...connectionAttrs },
            });
            storedGreeting = undefined;
          }
          // Issue #414: session is now configured for audio; send any append chunks queued before session.updated.
          flushPendingAudio();
        } else if (msg.type === 'response.output_text.done') {
          responseInProgress = false;
          hasSentAgentStartedSpeakingForCurrentResponse = false; // Issue #482: response ended
          // Issue #462 / #470: After function_call_output we deferred response.create; send it now so the API can start the next turn.
          if (pendingResponseCreateAfterFunctionCallOutput) {
            pendingResponseCreateAfterFunctionCallOutput = false;
            upstream.send(JSON.stringify({ type: 'response.create' }));
            responseInProgress = true;
            hasSentAgentStartedSpeakingForCurrentResponse = false;
          }
          const m = msg as { type: string; text?: string };
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `upstream→client: ${msg.type}${m.text?.startsWith('Function call:') ? ' (transcript-like)' : ''}`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: msg.type },
          });
          // Issue #482: Send AgentStartedSpeaking before ConversationText so component sees "agent active" (avoids client idle timeout).
          if (!hasSentAgentStartedSpeakingForCurrentResponse) {
            clientWs.send(JSON.stringify({ type: 'AgentStartedSpeaking' }));
            hasSentAgentStartedSpeakingForCurrentResponse = true;
          }
          const conversationText = mapOutputTextDoneToConversationText(msg as Parameters<typeof mapOutputTextDoneToConversationText>[0]);
          clientWs.send(JSON.stringify(conversationText));
          clientWs.send(JSON.stringify({ type: 'AgentAudioDone' }));
          // Issue #482: Flush buffered idle_timeout Error so client receives ConversationText before Error.
          if (pendingIdleTimeoutError && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(pendingIdleTimeoutError));
            pendingIdleTimeoutError = null;
          }
        } else if (msg.type === 'response.output_audio_transcript.done') {
          const m = msg as { type: string; transcript?: string };
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `upstream→client: ${msg.type}${m.transcript?.startsWith('Function call:') ? ' (transcript-like)' : ''}`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: msg.type },
          });
          const conversationText = mapOutputAudioTranscriptDoneToConversationText(
            msg as Parameters<typeof mapOutputAudioTranscriptDoneToConversationText>[0]
          );
          clientWs.send(JSON.stringify(conversationText));
        } else if (msg.type === 'response.function_call_arguments.done') {
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `upstream→client: ${msg.type} → sending FunctionCallRequest + ConversationText`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: msg.type },
          });
          // Issue #482: Send AgentStartedSpeaking before FunctionCallRequest so component sees "agent active" (same as other response outputs).
          if (!hasSentAgentStartedSpeakingForCurrentResponse) {
            clientWs.send(JSON.stringify({ type: 'AgentStartedSpeaking' }));
            hasSentAgentStartedSpeakingForCurrentResponse = true;
          }
          const functionCallRequest = mapFunctionCallArgumentsDoneToFunctionCallRequest(
            msg as Parameters<typeof mapFunctionCallArgumentsDoneToFunctionCallRequest>[0]
          );
          clientWs.send(JSON.stringify(functionCallRequest));
          const conversationText = mapFunctionCallArgumentsDoneToConversationText(
            msg as Parameters<typeof mapFunctionCallArgumentsDoneToConversationText>[0]
          );
          clientWs.send(JSON.stringify(conversationText));
        } else if (msg.type === 'error') {
          const isSessionMaxDuration = isSessionMaxDurationError(msg as Parameters<typeof isSessionMaxDurationError>[0]);
          const isIdleTimeout = isIdleTimeoutClosure(msg as Parameters<typeof isIdleTimeoutClosure>[0]);
          const isExpectedClosure = isSessionMaxDuration || isIdleTimeout;
          {
            const logBody = isSessionMaxDuration
              ? `expected session limit: ${msg.error?.message ?? 'session max duration'}`
              : isIdleTimeout
                ? `expected idle timeout closure: ${msg.error?.message ?? 'idle timeout'}`
                : (msg.error?.message ?? String(msg));
            const closureCode = isSessionMaxDuration ? 'session_max_duration' : isIdleTimeout ? 'idle_timeout' : (msg.error?.code ?? '');
            emitLog({
              severityNumber: isExpectedClosure ? SeverityNumber.INFO : SeverityNumber.ERROR,
              severityText: isExpectedClosure ? 'INFO' : 'ERROR',
              body: logBody,
              attributes: {
                ...connectionAttrs,
                [ATTR_DIRECTION]: 'upstream→client',
                [ATTR_MESSAGE_TYPE]: 'error',
                [ATTR_ERROR_CODE]: closureCode,
                [ATTR_ERROR_MESSAGE]: msg.error?.message ?? '',
              },
            });
          }
          const componentError = mapErrorToComponentError(msg as Parameters<typeof mapErrorToComponentError>[0]);
          // Issue #482: Buffer idle_timeout only when a response is in progress (we may still get output_text.done); otherwise send immediately.
          if (isIdleTimeout && responseInProgress && clientWs.readyState === WebSocket.OPEN) {
            pendingIdleTimeoutError = componentError;
          } else {
            clientWs.send(JSON.stringify(componentError));
          }
        } else if (msg.type === 'input_audio_buffer.speech_started') {
          // Issue #414 COMPONENT-PROXY-INTERFACE-TDD: map OpenAI VAD to component contract (COMPONENT-PROXY-INTERFACE-TDD.md §2.1)
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'upstream→client: input_audio_buffer.speech_started → UserStartedSpeaking',
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'input_audio_buffer.speech_started' },
          });
          clientWs.send(JSON.stringify({ type: 'UserStartedSpeaking' }));
        } else if (msg.type === 'input_audio_buffer.speech_stopped') {
          // Issue #414 COMPONENT-PROXY-INTERFACE-TDD: map to UtteranceEnd with channel and last_word_end (component contract)
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'upstream→client: input_audio_buffer.speech_stopped → UtteranceEnd',
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'input_audio_buffer.speech_stopped' },
          });
          clientWs.send(JSON.stringify({ type: 'UtteranceEnd', channel: [0, 1], last_word_end: 0 }));
        } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          // Issue #414: map OpenAI user transcript to component Transcript → onTranscriptUpdate
          const completedMsg = msg as Parameters<typeof mapInputAudioTranscriptionCompletedToTranscript>[0];
          const transcriptText = (completedMsg.transcript ?? '').slice(0, 60);
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `input_audio_transcription.completed → Transcript (${transcriptText}${(completedMsg.transcript?.length ?? 0) > 60 ? '...' : ''})`,
            attributes: { [ATTR_CONNECTION_ID]: connId, [ATTR_DIRECTION]: 'upstream→client' },
          });
          const transcript = mapInputAudioTranscriptionCompletedToTranscript(completedMsg);
          clientWs.send(JSON.stringify(transcript));
        } else if (msg.type === 'conversation.item.input_audio_transcription.delta') {
          // Issue #414: send interim transcript (delta); we do not accumulate across deltas here (each delta is sent as its own Transcript)
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: 'upstream→client: input_audio_transcription.delta → Transcript (interim)',
            attributes: { [ATTR_CONNECTION_ID]: connId, [ATTR_DIRECTION]: 'upstream→client' },
          });
          const transcript = mapInputAudioTranscriptionDeltaToTranscript(
            msg as Parameters<typeof mapInputAudioTranscriptionDeltaToTranscript>[0]
          );
          clientWs.send(JSON.stringify(transcript));
        } else if (msg.type === 'response.output_audio.delta') {
          // Component expects raw PCM (binary frame) for playback; upstream sends JSON with base64 delta.
          const delta = msg.delta;
          if (delta && typeof delta === 'string') {
            const pcm = Buffer.from(delta, 'base64');
            if (pcm.length > 0) {
              // Issue #482: Send AgentStartedSpeaking before first audio chunk so component sees "agent active".
              if (!hasSentAgentStartedSpeakingForCurrentResponse) {
                clientWs.send(JSON.stringify({ type: 'AgentStartedSpeaking' }));
                hasSentAgentStartedSpeakingForCurrentResponse = true;
              }
              if (ttsBoundaryDebug && lastTtsChunk !== null) {
                const bufA = lastTtsChunk;
                const bufB = pcm;
                const lastBytesA = bufA.length >= 2 ? [bufA[bufA.length - 2], bufA[bufA.length - 1]] : (bufA.length === 1 ? [bufA[0]] : []);
                const firstBytesB = bufB.length >= 2 ? [bufB[0], bufB[1]] : (bufB.length === 1 ? [bufB[0]] : []);
                const lastSampleLE = bufA.length >= 2 ? bufA.readInt16LE(bufA.length - 2) : undefined;
                const firstSampleLE = bufB.length >= 2 ? bufB.readInt16LE(0) : undefined;
                let carriedPlusFirst: number | undefined;
                if (bufA.length % 2 === 1 && bufB.length >= 1) {
                  const u = bufA.readUInt8(bufA.length - 1) | (bufB.readUInt8(0) << 8);
                  carriedPlusFirst = u > 0x7fff ? u - 0x10000 : u;
                }
                emitLog({
                  severityNumber: SeverityNumber.DEBUG,
                  severityText: 'DEBUG',
                  body: `TTS boundary after chunk ${ttsChunkLengths.length - 1}: lengths ${bufA.length}, ${bufB.length}; last A (LE: ${lastSampleLE ?? 'n/a'}); first B (LE: ${firstSampleLE ?? 'n/a'})${carriedPlusFirst !== undefined ? `; carried+first: ${carriedPlusFirst}` : ''}`,
                  attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'response.output_audio.delta' },
                });
              }
              ttsChunkLengths.push(pcm.length);
              lastTtsChunk = pcm;
              clientWs.send(pcm);
            }
          }
        } else if (msg.type === 'response.output_audio.done') {
          if (ttsBoundaryDebug && ttsChunkLengths.length > 0) {
            emitLog({
              severityNumber: SeverityNumber.DEBUG,
              severityText: 'DEBUG',
              body: `TTS chunk lengths (first ${Math.min(ttsChunkLengths.length, 10)}): ${ttsChunkLengths.slice(0, 10).join(', ')}${ttsChunkLengths.length > 10 ? '...' : ''}`,
              attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'response.output_audio.done' },
            });
          }
          ttsChunkLengths = [];
          lastTtsChunk = null;
          // Issue #482: Notify component that agent audio for this response is done (so idle timeout sees activity).
          clientWs.send(JSON.stringify({ type: 'AgentAudioDone' }));
          // Issue #462: do not clear responseInProgress here. Real API may send output_audio.done before
          // output_text.done; clearing here would allow a subsequent Settings → session.update while the API
          // still has an active response → conversation_already_has_active_response. Clear only on output_text.done.
        } else if (msg.type === 'response.done') {
          // Issue #470: API may send response.done to mark response complete (e.g. after function-call turn).
          // If we deferred response.create after function_call_output, send it now so the next turn can start.
          responseInProgress = false;
          hasSentAgentStartedSpeakingForCurrentResponse = false; // Issue #482: response ended
          if (pendingResponseCreateAfterFunctionCallOutput) {
            pendingResponseCreateAfterFunctionCallOutput = false;
            upstream.send(JSON.stringify({ type: 'response.create' }));
            responseInProgress = true;
            hasSentAgentStartedSpeakingForCurrentResponse = false;
          }
        } else if (msg.type === 'conversation.item.created' || msg.type === 'conversation.item.added' || msg.type === 'conversation.item.done') {
          // Issue #388 / #414: decrement the counter once per unique item; send response.create when all pending items are confirmed.
          // Issue #470: do not send response.create from this path when we deferred after function_call_output — the API still has
          // that response active; we must wait for response.output_text.done or response.done. (API may send item.added for the
          // user message late, after function_call_arguments.done; sending response.create here would trigger conversation_already_has_active_response.)
          if (pendingItemAddedBeforeResponseCreate > 0 && !pendingResponseCreateAfterFunctionCallOutput) {
            const itemId = (msg as { item?: { id?: string } }).item?.id;
            if (itemId && !pendingItemAckedIds.has(itemId)) {
              pendingItemAckedIds.add(itemId);
              pendingItemAddedBeforeResponseCreate--;
              if (pendingItemAddedBeforeResponseCreate === 0) {
                pendingItemAckedIds.clear();
                upstream.send(JSON.stringify({ type: 'response.create' }));
                responseInProgress = true;
                hasSentAgentStartedSpeakingForCurrentResponse = false; // Issue #482: new response
              }
            } else if (!itemId) {
              // Fallback for events without item.id: decrement unconditionally (legacy behavior)
              pendingItemAddedBeforeResponseCreate--;
              if (pendingItemAddedBeforeResponseCreate === 0) {
                pendingItemAckedIds.clear();
                upstream.send(JSON.stringify({ type: 'response.create' }));
                responseInProgress = true;
                hasSentAgentStartedSpeakingForCurrentResponse = false; // Issue #482: new response
              }
            }
          }
          // Issue #414: send as text so component routes as message, not binary (audio)
          clientWs.send(text);
        } else {
          // Issue #414: send as text so component routes as message, not binary (audio)
          clientWs.send(text);
        }
      } catch {
        // Issue #414: forward as text so JSON is not routed to audio pipeline
        clientWs.send(raw.toString('utf8'));
      }
    });

    upstream.on('close', (code: number, reason?: Buffer) => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      // Issue #482: Flush buffered idle_timeout Error so client receives it before we close the client.
      if (pendingIdleTimeoutError && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(pendingIdleTimeoutError));
        pendingIdleTimeoutError = null;
      }
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
        emitLog({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: description,
          attributes: {
            ...connectionAttrs,
            [ATTR_UPSTREAM_CLOSE_CODE]: code,
            [ATTR_UPSTREAM_CLOSE_REASON]: reasonStr,
          },
        });
      }
      clientWs.close();
    });
    (clientWs as unknown as WsLike).on('close', () => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      upstream.close();
    });
    (clientWs as unknown as WsLike).on('error', () => upstream.close());
  });

  return { wss, server };
}
