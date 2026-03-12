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
import fs from 'fs';
// Use require so we get CJS WebSocket; Server is on WebSocket.Server in ws/index.js
// Under Jest/ts-jest the default export may not have .Server, so load Server from lib
/** Minimal type for ws WebSocket .on(); TS may infer DOM WebSocket which lacks .on(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ws .on() callback args vary by event (message, close, etc.)
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
  mapFunctionCallArgumentsDoneToFunctionCallRequest,
  mapFunctionCallResponseToConversationItemCreate,
  mapGreetingToConversationText,
  mapConversationItemAddedToConversationText,
  mapErrorToComponentError,
  type ComponentError,
  type OpenAIConversationItemEvent,
  binaryToInputAudioBufferAppend,
  mapInputAudioTranscriptionCompletedToTranscript,
  mapInputAudioTranscriptionDeltaToTranscript,
  mapSpeechStoppedToUtteranceEnd,
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

/**
 * Required upstream contract (REQUIRED-UPSTREAM-CONTRACT.md): After we send function_call_output, the API MUST
 * send response.done or response.output_text.done so we can send the deferred response.create. If the API does
 * not within this window, we log a contract violation and send response.create anyway to unstick the flow.
 */
const DEFERRED_RESPONSE_CREATE_TIMEOUT_MS = 20000;

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
  /**
   * Issue #522: Override deferred response.create timeout (ms). When set, used instead of DEFERRED_RESPONSE_CREATE_TIMEOUT_MS.
   * For integration tests only (short timeout to test the "upstream withholds completion" path). Production uses default 20s.
   */
  deferredResponseCreateTimeoutMs?: number;
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

  const deferredResponseCreateTimeoutMs = options.deferredResponseCreateTimeoutMs ?? DEFERRED_RESPONSE_CREATE_TIMEOUT_MS;

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
    /** Issue #489: track item IDs we already sent ConversationText for (dedupe across .created/.added/.done). */
    const sentConversationTextItemIds = new Set<string>();
    /** Issue #406: have we sent SettingsApplied to the client? Used to send clear Error when upstream closes before session ready. */
    let hasSentSettingsApplied = false;
    /** Issue #489: Prior-session context is no longer sent as conversation items; it is passed in session.update instructions only. */
    /** Issue #414: defer input_audio_buffer.append until after session.updated so session is configured for audio. */
    const pendingAudioQueue: Buffer[] = [];
    /** TODO: Not expected to keep. Only forward the first Settings per connection; duplicate Settings (e.g. on reconnect/reload) must not send a second session.update or upstream can error. */
    let hasForwardedSessionUpdate = false;
    /** Issue #489: Last Settings had context (reconnect). On session.updated do not send greeting to client; they already have it. */
    let hadContextInLastSettings = false;
    /** Issue #462 / #470: After sending function_call_output, defer response.create until we receive response.output_text.done so the API can close the previous response first (avoids conversation_already_has_active_response). */
    let pendingResponseCreateAfterFunctionCallOutput = false;
    /** Timeout: if upstream never sends response.done/output_text.done after function_call_output, unstick by sending response.create (REQUIRED-UPSTREAM-CONTRACT.md). */
    let deferredResponseCreateTimeoutId: ReturnType<typeof setTimeout> | null = null;
    /** Issue #522 diagnostic: when CAPTURE_UPSTREAM_AFTER_FCR=1, record upstream event types for 25s after sending function_call_output (DEFECT-ISOLATION-PROPOSAL.md). */
    let captureUpstreamAfterFcrStart: number | null = null;
    const captureUpstreamAfterFcrBuffer: Array<{ type: string; at_ms: number }> = [];
    let captureUpstreamAfterFcrTimeoutId: ReturnType<typeof setTimeout> | null = null;
    /** Issue #482: Have we sent AgentStartedSpeaking for the current response? So component sees "agent active" before ConversationText (avoids client idle timeout). Reset when response ends. */
    let hasSentAgentStartedSpeakingForCurrentResponse = false;
    /** Issue #482 / #489: Have we sent AgentAudioDone for the current response? AgentAudioDone = receipt complete only (legacy); we also send AgentDone for semantic "agent done" so the wire has the correct signal. See docs/issues/ISSUE-489/AGENT-DONE-SEMANTICS-AND-NAMING.md. */
    let hasSentAgentAudioDoneForCurrentResponse = false;
    /** Issue #482: Buffer idle_timeout Error and send after ConversationText so client can show assistant bubble before close. */
    let pendingIdleTimeoutError: ComponentError | null = null;
    /** Issue #497: accumulate input_audio_transcription.delta per item_id; clear on .completed for that item_id. */
    const transcriptionDeltaAccumulator = new Map<string, string>();
    /** Issue #414: TTS chunk boundary diagnostic (set OPENAI_PROXY_TTS_BOUNDARY_DEBUG=1 to log same format as test-app E2E). */
    let ttsChunkLengths: number[] = [];
    let lastTtsChunk: Buffer | null = null;
    const ttsBoundaryDebug = process.env.OPENAI_PROXY_TTS_BOUNDARY_DEBUG === '1';

    /** Issue #482: Response lifecycle helpers so agent-activity and idle_timeout buffering stay DRY. */
    const onResponseStarted = (): void => {
      responseInProgress = true;
      hasSentAgentStartedSpeakingForCurrentResponse = false;
      hasSentAgentAudioDoneForCurrentResponse = false;
    };

    /** Issue #522: Send deferred response.create after function_call_output (REQUIRED-UPSTREAM-CONTRACT.md). Clears timeout, resets flag, sends response.create, calls onResponseStarted. Call only when pendingResponseCreateAfterFunctionCallOutput is true. */
    const sendDeferredResponseCreate = (): void => {
      if (deferredResponseCreateTimeoutId) {
        clearTimeout(deferredResponseCreateTimeoutId);
        deferredResponseCreateTimeoutId = null;
      }
      pendingResponseCreateAfterFunctionCallOutput = false;
      upstream.send(JSON.stringify({ type: 'response.create' }));
      onResponseStarted();
    };
    const onResponseEnded = (): void => {
      responseInProgress = false;
      hasSentAgentStartedSpeakingForCurrentResponse = false;
      hasSentAgentAudioDoneForCurrentResponse = false;
    };
    /**
     * Send agent-done signals to client once per response so the component can transition to idle and start idle timeout.
     * We send both:
     * - AgentDone: semantic "agent done for the turn" (preferred; aligned with docs).
     * - AgentAudioDone: legacy receipt-complete only (NOT playback complete); kept for API compatibility. In comments always refer to it as "receipt complete."
     * Called from: response.output_text.done, response.output_audio.done, response.done (fallback for function-call turn).
     * If the client never receives these after a function result, the upstream API is not sending one of those three events (or is very slow).
     */
    const sendAgentAudioDoneIfNeeded = (): void => {
      if (!hasSentAgentAudioDoneForCurrentResponse && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'AgentDone' }));
        clientWs.send(JSON.stringify({ type: 'AgentAudioDone' }));
        hasSentAgentAudioDoneForCurrentResponse = true;
      }
    };
    const sendAgentStartedSpeakingIfNeeded = (): void => {
      if (!hasSentAgentStartedSpeakingForCurrentResponse && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'AgentStartedSpeaking' }));
        hasSentAgentStartedSpeakingForCurrentResponse = true;
      }
    };
    const flushPendingIdleTimeoutError = (): void => {
      if (pendingIdleTimeoutError && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(pendingIdleTimeoutError));
        pendingIdleTimeoutError = null;
      }
    };

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
          onResponseStarted();
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
      if (deferredResponseCreateTimeoutId) {
        clearTimeout(deferredResponseCreateTimeoutId);
        deferredResponseCreateTimeoutId = null;
      }
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
      if (deferredResponseCreateTimeoutId) {
        clearTimeout(deferredResponseCreateTimeoutId);
        deferredResponseCreateTimeoutId = null;
      }
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
          const toolsCount = (sessionUpdate.session as { tools?: unknown[] })?.tools?.length ?? 0;
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `session.update sent to upstream (tools=${toolsCount})`,
            attributes: { ...connectionAttrs, toolsCount: String(toolsCount) },
          });
          // Issue #489: Do not inject prior-session context as conversation items. Context is passed in session.update
          // instructions (buildInstructionsWithContext in translator) so the model has history without creating items
          // that the API would echo back and duplicate in the UI. See DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md.
          const hadContextInSettings = !!(settings.agent?.context?.messages?.length);
          if (hadContextInSettings) {
            hadContextInLastSettings = true;
          }
          const g = settings.agent?.greeting;
          storedGreeting = typeof g === 'string' && g.trim().length > 0 ? g : undefined;
        } else if (msg.type === 'FunctionCallResponse') {
          const itemCreate = mapFunctionCallResponseToConversationItemCreate(
            msg as Parameters<typeof mapFunctionCallResponseToConversationItemCreate>[0]
          );
          upstream.send(JSON.stringify(itemCreate));
          const debugLogPath = process.env.E2E_FUNCTION_CALL_DEBUG_LOG;
          if (debugLogPath && itemCreate.item?.type === 'function_call_output') {
            try {
              const dir = path.dirname(debugLogPath);
              fs.mkdirSync(dir, { recursive: true });
              const payload = {
                call_id: itemCreate.item.call_id,
                outputLength: itemCreate.item.output?.length ?? 0,
                outputPreview: itemCreate.item.output?.slice(0, 120) ?? '',
                sentAt: new Date().toISOString(),
              };
              fs.writeFileSync(debugLogPath, JSON.stringify(payload, null, 2), 'utf8');
            } catch {
              // ignore write errors
            }
          }
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'FunctionCallResponse from client → function_call_output sent to upstream',
            attributes: { ...connectionAttrs },
          });
          // Issue #522 / #462 / #470: Do NOT send response.create here. The API allows only one active response
          // at a time. Sending response.create before the server has sent response.done (or response.output_text.done)
          // causes conversation_already_has_active_response (voice-commerce #1066). Defer response.create until
          // we receive response.output_text.done or response.done from upstream; those handlers send it when
          // pendingResponseCreateAfterFunctionCallOutput is true.
          pendingResponseCreateAfterFunctionCallOutput = true;
          // Issue #522 diagnostic: capture upstream event types for 25s after function_call_output (DEFECT-ISOLATION-PROPOSAL.md step 1).
          if (process.env.CAPTURE_UPSTREAM_AFTER_FCR === '1') {
            captureUpstreamAfterFcrStart = Date.now();
            captureUpstreamAfterFcrBuffer.length = 0;
            if (captureUpstreamAfterFcrTimeoutId) clearTimeout(captureUpstreamAfterFcrTimeoutId);
            captureUpstreamAfterFcrTimeoutId = setTimeout(() => {
              const outDir = path.join(process.cwd(), 'test-results');
              if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
              fs.writeFileSync(
                path.join(outDir, 'upstream-after-function-call.json'),
                JSON.stringify(
                  { captured_at: new Date().toISOString(), start_ms: captureUpstreamAfterFcrStart, events: [...captureUpstreamAfterFcrBuffer] },
                  null,
                  2
                )
              );
              captureUpstreamAfterFcrStart = null;
              captureUpstreamAfterFcrTimeoutId = null;
            }, 25000);
          }
          // Enforce required upstream contract (REQUIRED-UPSTREAM-CONTRACT.md): if API never sends completion,
          // unstick after timeout so the client can get a next turn instead of hanging until idle timeout.
          if (deferredResponseCreateTimeoutId) clearTimeout(deferredResponseCreateTimeoutId);
          deferredResponseCreateTimeoutId = setTimeout(() => {
            deferredResponseCreateTimeoutId = null;
            if (!pendingResponseCreateAfterFunctionCallOutput || upstream.readyState !== WebSocket.OPEN) return;
            emitLog({
              severityNumber: SeverityNumber.ERROR,
              severityText: 'ERROR',
              body: `Required upstream contract violated: upstream did not send response.done, response.output_text.done, or conversation.item.done (function_call_output) after function_call_output within ${deferredResponseCreateTimeoutMs}ms. Sending response.create to unstick; see REQUIRED-UPSTREAM-CONTRACT.md.`,
              attributes: {
                ...connectionAttrs,
                [ATTR_DIRECTION]: 'upstream→client',
                [ATTR_MESSAGE_TYPE]: 'contract_violation',
                'timeout_ms': String(deferredResponseCreateTimeoutMs),
              },
            });
            sendDeferredResponseCreate();
          }, deferredResponseCreateTimeoutMs);
          // Issue #487 / voice-commerce: Signal "agent is working" so the component can clear "waiting for next
          // agent message" and allow idle timeout to run once the turn completes.
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'AgentThinking', content: '' }));
          }
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
        if (captureUpstreamAfterFcrStart !== null && msg.type && Date.now() - captureUpstreamAfterFcrStart < 25000) {
          captureUpstreamAfterFcrBuffer.push({ type: msg.type, at_ms: Date.now() - captureUpstreamAfterFcrStart });
        }
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
          const settingsApplied = mapSessionUpdatedToSettingsApplied(msg as Parameters<typeof mapSessionUpdatedToSettingsApplied>[0]);
          clientWs.send(JSON.stringify(settingsApplied));
          // Issue #489: When client sent context (reconnect), do not send greeting again; they already have it in history.
          const sendGreeting = storedGreeting && !hadContextInLastSettings;
          if (sendGreeting) {
            // Issue #414 fix: greeting is text-only to client. Do NOT send conversation.item.create
            // (assistant) to upstream — OpenAI Realtime API errors on client-created assistant messages.
            // The greeting text is shown immediately in the UI; the model sees the greeting text in
            // its instructions (if configured) so it knows it already greeted the user.
            clientWs.send(JSON.stringify(mapGreetingToConversationText(storedGreeting!)));
            // Issue #489: Send AgentAudioDone after greeting so the component can transition to idle
            // and the idle timeout can start (E2E "timeout after greeting" tests).
            sendAgentAudioDoneIfNeeded();
            emitLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: 'greeting sent to client only (not upstream; OpenAI Realtime rejects client-created assistant items)',
              attributes: { ...connectionAttrs },
            });
          } else if (storedGreeting && hadContextInLastSettings) {
            emitLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: 'greeting not sent (context present; client already has history)',
              attributes: { ...connectionAttrs },
            });
          }
          if (storedGreeting) storedGreeting = undefined;
          hadContextInLastSettings = false;
          // Issue #414: session is now configured for audio; send any append chunks queued before session.updated.
          flushPendingAudio();
        } else if (msg.type === 'response.output_text.done') {
          // Upstream requirement: use conversation.item for finalized message and conversation history; response.output_text.done is control only. We do not map this event to ConversationText.
          onResponseEnded();
          // Issue #462 / #470: After function_call_output we deferred response.create; send it now so the API can start the next turn.
          if (pendingResponseCreateAfterFunctionCallOutput) {
            sendDeferredResponseCreate();
          }
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'response.output_text.done → control only (upstream requirement: assistant text from conversation.item.*)',
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: msg.type },
          });
          sendAgentStartedSpeakingIfNeeded();
          sendAgentAudioDoneIfNeeded();
          flushPendingIdleTimeoutError();
        } else if (msg.type === 'response.output_audio_transcript.done') {
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `upstream→client: ${msg.type} (control only; upstream requirement: assistant text from conversation.item.*)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: msg.type },
          });
          // Upstream requirement: ConversationText only from conversation.item.*; do not map control events.
        } else if (msg.type === 'response.output_audio_transcript.delta') {
          // Real API streams transcript deltas; we use conversation.item.* for finalized text (Epic #493).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'response.output_audio_transcript.delta' },
          });
        } else if (msg.type === 'response.function_call_arguments.done') {
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `upstream→client: ${msg.type} → FunctionCallRequest only (assistant text from conversation.item.*)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: msg.type },
          });
          sendAgentStartedSpeakingIfNeeded();
          const functionCallRequest = mapFunctionCallArgumentsDoneToFunctionCallRequest(
            msg as Parameters<typeof mapFunctionCallArgumentsDoneToFunctionCallRequest>[0]
          );
          clientWs.send(JSON.stringify(functionCallRequest));
          // Upstream requirement: ConversationText only from conversation.item.*
        } else if (msg.type === 'error') {
          const componentError = mapErrorToComponentError(msg as Parameters<typeof mapErrorToComponentError>[0]);
          const isExpectedClosure =
            componentError.code === 'idle_timeout' || componentError.code === 'session_max_duration';
          // Issue #522: Do not treat conversation_already_has_active_response as fatal. Log at INFO and do not
          // forward to the client so the component does not trigger reconnection/re-Settings and duplicate function calls.
          const isConversationAlreadyHasActiveResponse = componentError.code === 'conversation_already_has_active_response';
          {
            const logBody = isExpectedClosure
              ? `expected closure (${componentError.code}): ${msg.error?.message ?? componentError.code}`
              : isConversationAlreadyHasActiveResponse
                ? `non-fatal (${componentError.code}): ${msg.error?.message ?? componentError.code} — not forwarded to client`
                : (msg.error?.message ?? String(msg));
            emitLog({
              severityNumber: isExpectedClosure || isConversationAlreadyHasActiveResponse ? SeverityNumber.INFO : SeverityNumber.ERROR,
              severityText: isExpectedClosure || isConversationAlreadyHasActiveResponse ? 'INFO' : 'ERROR',
              body: logBody,
              attributes: {
                ...connectionAttrs,
                [ATTR_DIRECTION]: 'upstream→client',
                [ATTR_MESSAGE_TYPE]: 'error',
                [ATTR_ERROR_CODE]: componentError.code,
                [ATTR_ERROR_MESSAGE]: msg.error?.message ?? '',
              },
            });
          }
          // Issue #482: Buffer idle_timeout only when a response is in progress (we may still get output_text.done); otherwise send immediately.
          if (componentError.code === 'idle_timeout' && responseInProgress && clientWs.readyState === WebSocket.OPEN) {
            pendingIdleTimeoutError = componentError;
          } else if (!isConversationAlreadyHasActiveResponse) {
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
          // Issue #494: map upstream channel and last_word_end to UtteranceEnd; defaults when absent
          const utteranceEnd = mapSpeechStoppedToUtteranceEnd(msg as Parameters<typeof mapSpeechStoppedToUtteranceEnd>[0]);
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `upstream→client: input_audio_buffer.speech_stopped → UtteranceEnd (channel=${JSON.stringify(utteranceEnd.channel)} last_word_end=${utteranceEnd.last_word_end})`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'input_audio_buffer.speech_stopped' },
          });
          clientWs.send(JSON.stringify(utteranceEnd));
        } else if (
          msg.type === 'input_audio_buffer.committed' ||
          msg.type === 'input_audio_buffer.cleared' ||
          msg.type === 'input_audio_buffer.timeout_triggered'
        ) {
          // Buffer control/ack events: no component message. Deepgram Voice Agent API has no equivalent (component AgentResponseType has none of these); upstream-only signals — handle explicitly for parity, log only (Issue #414 firm-audio; Epic #493).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: String(msg.type) },
          });
        } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          // Issue #414: map OpenAI user transcript to component Transcript → onTranscriptUpdate
          const completedMsg = msg as Parameters<typeof mapInputAudioTranscriptionCompletedToTranscript>[0];
          const itemId = completedMsg.item_id;
          if (itemId) transcriptionDeltaAccumulator.delete(itemId);
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
          // Issue #497: accumulate deltas per item_id; send Transcript with accumulated text (DRY: translator already accepts accumulated).
          const deltaMsg = msg as Parameters<typeof mapInputAudioTranscriptionDeltaToTranscript>[0];
          const itemId = deltaMsg.item_id ?? '';
          const accumulated = transcriptionDeltaAccumulator.get(itemId) ?? '';
          const transcript = mapInputAudioTranscriptionDeltaToTranscript(deltaMsg, accumulated);
          transcriptionDeltaAccumulator.set(itemId, transcript.transcript);
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream→client: input_audio_transcription.delta → Transcript (interim, accumulated length=${transcript.transcript.length})`,
            attributes: { [ATTR_CONNECTION_ID]: connId, [ATTR_DIRECTION]: 'upstream→client' },
          });
          clientWs.send(JSON.stringify(transcript));
        } else if (msg.type === 'response.output_audio.delta') {
          // Component expects raw PCM (binary frame) for playback; upstream sends JSON with base64 delta.
          const delta = msg.delta;
          if (delta && typeof delta === 'string') {
            const pcm = Buffer.from(delta, 'base64');
            if (pcm.length > 0) {
              sendAgentStartedSpeakingIfNeeded();
              if (ttsBoundaryDebug && lastTtsChunk !== null) {
                const bufA = lastTtsChunk;
                const bufB = pcm;
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
          sendAgentAudioDoneIfNeeded();
          // Issue #462: do not clear responseInProgress here. Real API may send output_audio.done before
          // output_text.done; clearing here would allow a subsequent Settings → session.update while the API
          // still has an active response → conversation_already_has_active_response. Clear only on output_text.done.
        } else if (msg.type === 'response.done') {
          // Issue #482 / #489: Ensure client gets AgentAudioDone so component can transition to idle (e.g. when API sends response.done without output_text.done/output_audio.done).
          emitLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'Received response.done from upstream — sending AgentAudioDone to client (idle timeout can start). E2E: if this never appears after a function call, the real API is not sending response.done.',
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'response.done' },
          });
          sendAgentAudioDoneIfNeeded();
          // Issue #470: API may send response.done to mark response complete (e.g. after function-call turn).
          // If we deferred response.create after function_call_output, send it now so the next turn can start.
          onResponseEnded();
          if (pendingResponseCreateAfterFunctionCallOutput) {
            sendDeferredResponseCreate();
          }
        } else if (msg.type === 'response.created') {
          // Real API sends response.created when a response is created (e.g. after our response.create). Control event only; no component message (Epic #493).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'response.created' },
          });
        } else if (msg.type === 'response.output_item.added' || msg.type === 'response.output_item.done') {
          // Real API: output item added/done; content comes via conversation.item.* (Epic #493).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: String(msg.type) },
          });
        } else if (msg.type === 'response.content_part.added' || msg.type === 'response.content_part.done') {
          // Real API streaming control; finalized content from conversation.item.* (Epic #493).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: String(msg.type) },
          });
        } else if (msg.type === 'rate_limits.updated') {
          // Real API sends rate limit info; no component equivalent (Epic #493).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'rate_limits.updated' },
          });
        } else if (msg.type === 'response.output_text.added') {
          // Real API streaming control; finalized text from conversation.item.* (Epic #493).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'response.output_text.added' },
          });
        } else if (msg.type === 'conversation.created') {
          // Issue #517: Real API sends when a conversation is created; control event only. Explicitly ignore (log only) so we don't hit unmapped.
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'conversation.created' },
          });
        } else if (msg.type === 'conversation.item.input_audio_transcription.failed' || msg.type === 'conversation.item.input_audio_transcription.segment') {
          // Issue #517: Real API transcription lifecycle; no component equivalent. Explicitly ignore (log only).
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: String(msg.type) },
          });
        } else if (msg.type === 'conversation.item.deleted' || msg.type === 'conversation.item.truncated' || msg.type === 'conversation.item.retrieved') {
          // Canonical list: lifecycle events (item deleted/truncated/retrieved); no component equivalent. Explicit ignore.
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: String(msg.type) },
          });
        } else if (msg.type === 'input_audio_buffer.dtmf_event_received') {
          // Canonical list: DTMF from upstream; no component equivalent. Explicit ignore.
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: 'input_audio_buffer.dtmf_event_received' },
          });
        } else if (
          msg.type === 'mcp_list_tools.completed' ||
          msg.type === 'mcp_list_tools.failed' ||
          msg.type === 'mcp_list_tools.in_progress'
        ) {
          // Canonical list: MCP list-tools lifecycle; no component equivalent. Explicit ignore.
          emitLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `upstream: ${msg.type} (no client message)`,
            attributes: { ...connectionAttrs, [ATTR_DIRECTION]: 'upstream→client', [ATTR_MESSAGE_TYPE]: String(msg.type) },
          });
        } else if (msg.type === 'conversation.item.created' || msg.type === 'conversation.item.added' || msg.type === 'conversation.item.done') {
          // Debug: log raw upstream event (truncated) so we can inspect payload when not forwarded to client (Issue #500).
          {
            const MAX_RAW_DEBUG = 2000;
            const rawTruncated = text.length > MAX_RAW_DEBUG ? text.slice(0, MAX_RAW_DEBUG) + '…' : text;
            emitLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: `conversation.item.* raw (debug): type=${msg.type} item_id=${(msg as { item?: { id?: string } }).item?.id ?? 'n/a'} payload=${rawTruncated}`,
              attributes: {
                ...connectionAttrs,
                [ATTR_DIRECTION]: 'upstream→client',
                [ATTR_MESSAGE_TYPE]: String(msg.type),
              },
            });
          }
          // Issue #522: Per OpenAI Realtime API spec, conversation.item.done is "Returned when a conversation item is finalized."
          // When we send function_call_output, the API may only send item.added + item.done (no response.done). Treat
          // conversation.item.done for item.type === 'function_call_output' as completion signal (REQUIRED-UPSTREAM-CONTRACT.md).
          if (msg.type === 'conversation.item.done' && pendingResponseCreateAfterFunctionCallOutput) {
            const itemType = (msg as { item?: { type?: string } }).item?.type;
            if (itemType === 'function_call_output') {
              sendDeferredResponseCreate();
            }
          }
          // Issue #388 / #414: decrement the counter once per unique item; send response.create when all pending items are confirmed.
          // Issue #470: do not send response.create from this path when we deferred after function_call_output — the API still has
          // that response active; we must wait for response.output_text.done or response.done (or item.done for function_call_output, handled above). (API may send item.added for the
          // user message late, after function_call_arguments.done; sending response.create here would trigger conversation_already_has_active_response.)
          if (pendingItemAddedBeforeResponseCreate > 0 && !pendingResponseCreateAfterFunctionCallOutput) {
            const itemId = (msg as { item?: { id?: string } }).item?.id;
            if (itemId && !pendingItemAckedIds.has(itemId)) {
              pendingItemAckedIds.add(itemId);
              pendingItemAddedBeforeResponseCreate--;
              if (pendingItemAddedBeforeResponseCreate === 0) {
                pendingItemAckedIds.clear();
                upstream.send(JSON.stringify({ type: 'response.create' }));
                onResponseStarted();
              }
            } else if (!itemId) {
              // Fallback for events without item.id: decrement unconditionally (legacy behavior)
              pendingItemAddedBeforeResponseCreate--;
              if (pendingItemAddedBeforeResponseCreate === 0) {
                pendingItemAckedIds.clear();
                upstream.send(JSON.stringify({ type: 'response.create' }));
                onResponseStarted();
              }
            }
          }
          // Upstream requirement: use conversation.item for finalized message and conversation history. Map assistant content to ConversationText here only.
          // Real API may send assistant content in .created or .done instead of .added (Issue #489 / TDD-PLAN-ALL-MESSAGES-IN-HISTORY).
          if (clientWs.readyState === WebSocket.OPEN) {
            const itemRole = (msg as { item?: { role?: string } }).item?.role;
            const itemId = (msg as { item?: { id?: string } }).item?.id;
            const conversationText = mapConversationItemAddedToConversationText(msg as OpenAIConversationItemEvent);
            let didSend = false;
            if (conversationText) {
              if (itemId && sentConversationTextItemIds.has(itemId)) {
                // Already sent ConversationText for this item (e.g. from another of .created/.added/.done).
              } else {
                if (itemId) sentConversationTextItemIds.add(itemId);
                clientWs.send(JSON.stringify(conversationText));
                didSend = true;
              }
            }
            // Diagnostic: log every assistant item event so we can see what the real API sends and whether we mapped/sent.
            if (itemRole === 'assistant') {
              const MAX_LOG_PAYLOAD = 2000;
              const eventShape = JSON.stringify(msg);
              const truncated = eventShape.length > MAX_LOG_PAYLOAD ? eventShape.slice(0, MAX_LOG_PAYLOAD) + '…' : eventShape;
              emitLog({
                severityNumber: SeverityNumber.INFO,
                severityText: 'INFO',
                body: `conversation.item.* assistant event_type=${msg.type} item_id=${itemId ?? 'n/a'} mapped=${Boolean(conversationText)} sent=${didSend}. ${!conversationText ? `Raw payload (align mapper): ${truncated}` : ''}`,
                attributes: {
                  ...connectionAttrs,
                  [ATTR_DIRECTION]: 'upstream→client',
                  [ATTR_MESSAGE_TYPE]: String(msg.type),
                  itemRole: itemRole ?? '(missing)',
                  itemId: itemId ?? '(missing)',
                  mapped: String(Boolean(conversationText)),
                  sent: String(didSend),
                },
              });
            }
          }
          // Issue #500: Do not forward raw conversation.item.* to client; only mapped ConversationText (and counter/response.create) are sent.
        } else {
          // Issue #512: Unmapped upstream event — log warning only; do NOT send Error to client (avoids retry/re-Settings loops).
          const eventType = msg.type ?? '(unknown)';
          const payloadLen = typeof text === 'string' ? text.length : 0;
          const MAX_UNMAPPED_PAYLOAD_LOG = 4096;
          const fullPayloadTruncated =
            typeof text === 'string'
              ? text.length > MAX_UNMAPPED_PAYLOAD_LOG
                ? text.slice(0, MAX_UNMAPPED_PAYLOAD_LOG) + '…'
                : text
              : '(non-string)';
          emitLog({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: `Unmapped upstream event: ${eventType} (payload length ${payloadLen}) — log only; no client Error. Full payload (truncated): ${fullPayloadTruncated}`,
            attributes: {
              ...connectionAttrs,
              [ATTR_DIRECTION]: 'upstream→client',
              [ATTR_MESSAGE_TYPE]: String(eventType),
            },
          });
          // Do not send Error to client; continue processing the stream.
        }
      } catch {
        // Malformed or non-JSON upstream message: send Error instead of forwarding raw bytes.
        const fallbackError: ComponentError = {
          type: 'Error',
          code: 'unmapped_upstream_event',
          description: 'Proxy received upstream message that could not be parsed as JSON.',
        };
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(fallbackError));
        }
      }
    });

    upstream.on('close', (code: number, reason?: Buffer) => {
      if (audioCommitTimer) clearTimeout(audioCommitTimer);
      flushPendingIdleTimeoutError();
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
