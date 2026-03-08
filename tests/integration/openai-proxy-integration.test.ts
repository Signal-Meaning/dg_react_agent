/**
 * OpenAI proxy integration tests (Issue #381)
 *
 * Proxy as WebSocket server: real WebSocket connections, mock OpenAI upstream.
 * See docs/issues/ISSUE-381/INTEGRATION-TEST-PLAN.md.
 *
 * Why the "server had an error" (OpenAI) is not seen here: the upstream is a mock we control.
 * We never send an `error` event from the mock. The real OpenAI API sometimes sends that
 * error after a successful response; the test-app sees it because it talks to the real API
 * via the proxy. Integration tests verify translation and protocol, not live API behavior.
 *
 * Real upstream: set USE_REAL_APIS=1 and OPENAI_API_KEY to run a subset of tests
 * against the live OpenAI Realtime API. See docs/development/TEST-STRATEGY.md.
 *
 * Run order: integration tests first against real APIs (when keys available), then mocks.
 * CI runs mocks only.
 *
 * With USE_REAL_APIS=1 this file logs each test name as it runs (beforeEach). For more
 * Jest output use: npm test -- --verbose tests/integration/openai-proxy-integration.test.ts
 *
 * Client message parsing (see PROTOCOL-SPECIFICATION.md §5): Do not parse binary as JSON;
 * only parse when the frame looks like a complete JSON object. When parse throws, surface
 * the error (fail the test)—never skip frames on error so we can correct the cause.
 *
 * @jest-environment node
 */

import path from 'path';
// Load root .env and test-app/.env so OPENAI_API_KEY is available when running with USE_REAL_APIS=1
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'test-app', '.env') });

import http from 'http';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws');
// Load WebSocketServer from ws package (Jest resolve may not expose ws/lib/*)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));
import { DEFAULT_SERVER_TIMEOUT_MS, NO_SERVER_TIMEOUT_MS, SERVER_TIMEOUT_ERROR_CODE } from '../../src/constants/voice-agent';
import {
  createOpenAIProxyServer,
} from '../../packages/voice-agent-backend/scripts/openai-proxy/server';

/** When true, proxy uses real OpenAI Realtime URL and auth; mock is not started. Requires OPENAI_API_KEY. */
const useRealAPIs = (process.env.USE_REAL_APIS === '1' || process.env.USE_REAL_APIS === 'true') && !!process.env.OPENAI_API_KEY?.trim();

/**
 * Issue #462: Minimal in-process backend for function-call flow. Ensures we qualify on real HTTP to a backend,
 * not in-test hardcoded FunctionCallResponse. Contract: POST /function-call with { id, name, arguments };
 * responds with { content: string } (JSON string of result). Returns server and port; call server.close() when done.
 */
function createMinimalFunctionCallBackend(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || (req.url && !req.url.startsWith('/function-call'))) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      let body = '';
      req.on('data', (ch) => { body += ch; });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        // Contract: return { content: string } — same as test-app backend (Issue #407).
        const content = JSON.stringify({ time: '12:00', timezone: 'UTC' });
        res.end(JSON.stringify({ content }));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null && 'port' in addr ? (addr as { port: number }).port : 0;
      if (port) resolve({ server, port });
      else reject(new Error('Minimal function-call backend: could not get port'));
    });
    server.on('error', reject);
  });
}

/** Issue #414 RESOLUTION-PLAN: 100ms PCM at 24kHz 16-bit mono (bytes). */
const PCM_100MS_24K_BYTES = 4800;

/** Issue #414: Load speech-like PCM from project fixtures (TTS/recorded speech); 24 kHz for proxy. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AudioFileLoader = require('../utils/audio-file-loader');
/** Use for tests that require the mock upstream (exact payloads, mockReceived, etc.); skipped when USE_REAL_APIS=1. */
const itMockOnly = useRealAPIs ? it.skip : it;

/**
 * Schedules a fallback timeout for tests. When it fires, runs onFired in setImmediate so the
 * timer callback returns immediately (avoids open handle in --detectOpenHandles).
 * Returns a clear function; call it from the success path (e.g. finish()) to cancel the timeout.
 */
function scheduleFallbackTimeout(delayMs: number, onFired: () => void): () => void {
  const id = setTimeout(() => setImmediate(onFired), delayMs);
  return () => clearTimeout(id);
}

/**
 * True when the buffer looks like a complete JSON object (starts with '{', ends with '}').
 * Use to avoid calling JSON.parse on binary frames (e.g. PCM). When we do parse and it
 * throws, tests must surface the error (PROTOCOL-SPECIFICATION.md §5).
 */
function looksLikeJsonObject(data: Buffer): boolean {
  return data.length >= 2 && data[0] === 0x7b && data[data.length - 1] === 0x7d;
}

describe('OpenAI proxy integration (Issue #381)', () => {
  // Prevent real-API runs from hanging indefinitely; longest test is 70s (function-call flow).
  if (useRealAPIs) jest.setTimeout(80000);
  // Mock runs: WebSocket round-trips can exceed default 5s under load; use 15s unless test overrides.
  else jest.setTimeout(15000);

  let mockUpstreamServer: http.Server | null = null;
  let mockWss: InstanceType<typeof WebSocketServer> | null = null;
  let mockPort: number;
  let proxyServer: http.Server;
  let proxyPort: number;
  const PROXY_PATH = '/openai';
  const mockReceived: Array<{ type: string; at?: number }> = [];
  /** When > 0, mock sends conversation.item.added this many ms after receiving conversation.item.create (user). Issue #388: proxy must send response.create only after item.added. */
  let mockDelayItemAddedForInjectUserMessageMs = 0;
  /** Issue #414: when true, mock sends session.created on connection open (before any session.update) to simulate real OpenAI behavior. */
  let mockSendSessionCreatedOnConnect = false;
  /** Issue #414: when true, mock sends conversation.item.added for assistant messages too (not just user). Needed for greeting TTS. */
  let mockSendItemAddedForAssistant = false;
  /** Issue #414 TDD: when true, mock sends conversation.item.created (legacy) instead of conversation.item.added for assistant messages. */
  let mockSendItemCreatedInsteadOfAdded = false;
  /** Issue #414 TDD: when true, mock also sends conversation.item.done after conversation.item.added (or .created) for ALL items (user + assistant). Simulates real OpenAI lifecycle. */
  let mockSendItemDoneAfterAdded = false;
  /** Issue #414 TDD: when true, mock sends response.output_audio.delta (base64 PCM) before text on response.create (greeting audio path). */
  let mockSendAudioDeltaOnGreetingResponseCreate = false;
  /** Issue #414 TDD: delay (ms) before mock sends .added for assistant (greeting) items. Used to expose double-decrement bug. */
  let mockDelayAssistantItemAddedMs = 0;
  /** Issue #414 TDD: when true, mock records protocol error if response.create arrives before all items are acknowledged. */
  let mockEnforceAllItemsAckedBeforeResponseCreate = false;
  /**
   * Issue #414 TDD: when true, mock sends an error event (instead of a normal response) when
   * response.create is received and the last conversation.item.create was role=assistant.
   * Simulates the real OpenAI Realtime API behavior: "The server had an error while processing
   * your request." This is the exact failure pattern from manual testing.
   */
  let mockSendErrorOnAssistantResponseCreate = false;
  /** When true, mock sends response.function_call_arguments.done after session.updated (for function-call test) */
  let mockSendFunctionCallAfterSession = false;
  /** When true, mock sends only response.output_audio_transcript.done with "Function call: ..." after session.updated (no .done event) */
  let mockSendTranscriptOnlyAfterSession = false;
  /** When true, mock sends only response.output_text.done with "Function call: ..." after session.updated (no .done event) */
  let mockSendOutputTextOnlyAfterSession = false;
  /** When true, mock sends output_audio_transcript.done then response.function_call_arguments.done after session.updated */
  let mockSendTranscriptThenFunctionCallAfterSession = false;
  /** Issue #497: when true, mock sends multiple input_audio_transcription.delta events (same item_id) after session.updated to test accumulator. */
  let mockSendTranscriptionDeltasForAccumulator = false;
  /** Issue #496: when true, mock sends input_audio_transcription.completed with start, duration, channel so client receives Transcript with actuals. */
  let mockSendTranscriptionCompletedWithActuals = false;
  /** Issue #499: when true, mock sends conversation.item.added with assistant item whose content is only a function_call part (parity: client receives ConversationText). */
  let mockSendConversationItemAddedFunctionCallOnly = false;
  /** When true, mock sends response.output_audio.delta (base64 PCM) then .done before response.output_text.done (so client receives binary PCM from proxy). */
  let mockSendOutputAudioBeforeText = false;
  /** Issue #414 3.2: when > 0, mock delays sending response completion (output_audio.delta, .done, output_text.done) by this many ms after receiving response.create. */
  let mockDelayResponseDoneMs = 0;
  /**
   * Issue #462: when true, mock sends response.output_audio.delta + .done first, then sends response.output_text.done
   * after mockDelayOutputTextDoneAfterAudioMs. Lets test assert proxy does not send session.update between audio.done and text.done.
   */
  let mockSendOnlyAudioDoneFirst = false;
  /** Issue #462: delay (ms) before sending output_text.done when mockSendOnlyAudioDoneFirst is true. */
  let mockDelayOutputTextDoneAfterAudioMs = 300;
  /**
   * Issue #462 TDD: when true, mock sends session.created then session.updated on connect (without receiving
   * session.update). So proxy has hasSentSettingsApplied true but hasForwardedSessionUpdate false. Lets test
   * assert that when client sends Settings after output_audio.done but before output_text.done, proxy does not
   * send session.update (responseInProgress must stay true until output_text.done).
   */
  let mockSendSessionUpdatedOnConnect = false;
  /**
   * Issue #406: when true, mock delays sending session.updated and asserts that no conversation.item.create
   * is received before session.updated was sent (catches proxy sending context before session.updated).
   */
  let mockEnforceSessionBeforeContext = false;
  /** Protocol test: when true, mock sends an unmapped upstream event after session.updated so client receives Error (unmapped_upstream_event). Uses conversation.created (response.created is now handled in proxy). */
  let mockSendUnmappedEventAfterSessionUpdated = false;
  /**
   * Issue #470: when true, on function_call_output mock sends response.done only (no response.output_text.done).
   * Asserts proxy sends response.create once when it receives response.done (fallback path).
   */
  let mockSendResponseDoneOnlyAfterFunctionCallOutput = false;
  /**
   * Issue #482 (voice-commerce #956): when true, on response.create mock sends error (idle_timeout) BEFORE
   * response.output_text.done. Reproduces upstream closing before final assistant message; proxy must still
   * deliver ConversationText (assistant) before Error so the UI can show the bubble.
   */
  let mockSendIdleTimeoutBeforeOutputTextDone = false;
  /** Protocol errors detected by mock (e.g. conversation.item.create before session.updated). Tests assert this is empty. */
  const protocolErrors: Error[] = [];
  /** Records conversation.item.create payloads for assertions */
  const receivedConversationItems: Array<{ type: string; item?: { type?: string; call_id?: string; output?: string; role?: string } }> = [];
  /** Issue #414 TDD: records session.update payloads sent to upstream for assertions (e.g. turn_detection) */
  const receivedSessionUpdatePayloads: Array<{ type: string; session?: { turn_detection?: unknown; [key: string]: unknown } }> = [];

  beforeAll(async () => {
    if (useRealAPIs) process.stdout.write('[openai-proxy-integration] beforeAll: starting proxy...\n');
    proxyServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => proxyServer.listen(0, () => resolve()));
    proxyPort = (proxyServer.address() as { port: number }).port;

    if (useRealAPIs) {
      const apiKey = process.env.OPENAI_API_KEY!.trim();
      const upstreamUrl = process.env.OPENAI_REALTIME_URL ?? 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
      createOpenAIProxyServer({
        server: proxyServer,
        path: PROXY_PATH,
        upstreamUrl,
        upstreamHeaders: { Authorization: `Bearer ${apiKey}` },
        logLevel: process.env.LOG_LEVEL ?? undefined,
      });
      mockPort = 0;
      if (useRealAPIs) process.stdout.write(`[openai-proxy-integration] beforeAll: proxy ready on port ${proxyPort}. Use --verbose to see each test name as it runs.\n`);
      return;
    }

    mockUpstreamServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => mockUpstreamServer!.listen(0, () => resolve()));
    mockPort = (mockUpstreamServer!.address() as { port: number }).port;
    mockWss = new WebSocketServer({ server: mockUpstreamServer! });
    mockWss!.on('connection', (socket: import('ws')) => {
      /** Issue #406: per-connection; true after we have sent session.updated (used when mockEnforceSessionBeforeContext). */
      let sessionUpdatedSent = false;
      /** Issue #414 TDD: per-connection counters for protocol enforcement. */
      let itemCreateCount = 0;
      let itemAckedCount = 0;
      /** Issue #414 TDD: role of the last conversation.item.create received (used to simulate error on assistant response.create). */
      let lastItemCreateRole: string | undefined;
      // Issue #414: simulate real OpenAI behavior — send session.created immediately on connection
      if (mockSendSessionCreatedOnConnect) {
        socket.send(JSON.stringify({ type: 'session.created', session: { id: 'sess_mock', model: 'gpt-realtime', modalities: ['text', 'audio'] } }));
      }
      // Issue #462 TDD: send session.updated on connect so proxy has session ready but hasForwardedSessionUpdate still false
      if (mockSendSessionUpdatedOnConnect) {
        socket.send(JSON.stringify({ type: 'session.created', session: { id: 'sess_mock', model: 'gpt-realtime', modalities: ['text', 'audio'] } }));
        socket.send(JSON.stringify({ type: 'session.updated', session: { type: 'realtime' } }));
      }
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; item?: { type?: string; role?: string; content?: Array<{ type?: string }>; call_id?: string; output?: string } };
          if (msg.type) mockReceived.push({ type: msg.type, at: Date.now() });
          if (msg.type === 'input_audio_buffer.append') {
            if (!sessionUpdatedSent) {
              protocolErrors.push(new Error('input_audio_buffer.append received before session.updated was sent (protocol: audio must follow session.updated, Issue #414)'));
            }
          }
          if (msg.type === 'conversation.item.create') {
            if (mockEnforceSessionBeforeContext && !sessionUpdatedSent) {
              protocolErrors.push(new Error('conversation.item.create received before session.updated was sent (protocol: context must follow session.updated)'));
            }
            // OpenAI Realtime API: assistant messages must use content type output_text, not input_text
            const role = msg.item?.role;
            const content0 = msg.item?.content?.[0];
            if (role === 'assistant' && content0?.type === 'input_text') {
              protocolErrors.push(new Error("conversation.item.create for assistant must use content type 'output_text', got 'input_text' (OpenAI Realtime API)"));
            }
            receivedConversationItems.push({ type: msg.type, item: msg.item });
            itemCreateCount++;
            lastItemCreateRole = msg.item?.role;
            // Issue #470: proxy defers response.create until output_text.done (or response.done) after function_call_output.
            if (msg.item?.type === 'function_call_output') {
              if (mockSendResponseDoneOnlyAfterFunctionCallOutput) {
                socket.send(JSON.stringify({ type: 'response.done', response_id: 'resp_1' }));
              } else {
                socket.send(JSON.stringify({
                  type: 'response.output_text.done',
                  response_id: 'resp_1',
                  item_id: 'item_1',
                  output_index: 0,
                  content_index: 0,
                  text: 'Hello from mock',
                }));
              }
            }
            // Issue #388: proxy sends response.create only after conversation.item.added. Mock must send item.added for user messages.
            const isUserMessage = msg.item?.type === 'message' && msg.item?.role === 'user';
            const isAssistantMessage = msg.item?.type === 'message' && msg.item?.role === 'assistant';
            if (isUserMessage) {
              const delay = mockDelayItemAddedForInjectUserMessageMs;
              const sendItemAdded = () => {
                try {
                  socket.send(JSON.stringify({
                    type: 'conversation.item.added',
                    item: { id: 'item_mock_1', type: 'message', status: 'completed', role: 'user', content: msg.item?.content ?? [{ type: 'input_text', text: 'hi' }] },
                  }));
                  itemAckedCount++;
                  if (mockSendItemDoneAfterAdded) {
                    socket.send(JSON.stringify({
                      type: 'conversation.item.done',
                      item: { id: 'item_mock_1', type: 'message', status: 'completed', role: 'user', content: msg.item?.content ?? [{ type: 'input_text', text: 'hi' }] },
                    }));
                  }
                } catch {
                  // ignore
                }
              };
              if (delay > 0) setTimeout(sendItemAdded, delay);
              else sendItemAdded();
            }
            // Issue #414: send conversation.item.added (or .created) for assistant messages (greeting) so proxy can trigger response.create for TTS
            if (isAssistantMessage && (mockSendItemAddedForAssistant || mockSendItemCreatedInsteadOfAdded)) {
              const eventType = mockSendItemCreatedInsteadOfAdded ? 'conversation.item.created' : 'conversation.item.added';
              const sendAssistantEvents = () => {
                try {
                  socket.send(JSON.stringify({
                    type: eventType,
                    item: { id: 'item_mock_greeting', type: 'message', status: 'completed', role: 'assistant', content: msg.item?.content ?? [] },
                  }));
                  itemAckedCount++;
                  if (mockSendItemDoneAfterAdded) {
                    socket.send(JSON.stringify({
                      type: 'conversation.item.done',
                      item: { id: 'item_mock_greeting', type: 'message', status: 'completed', role: 'assistant', content: msg.item?.content ?? [] },
                    }));
                  }
                } catch {
                  // ignore
                }
              };
              if (mockDelayAssistantItemAddedMs > 0) {
                setTimeout(sendAssistantEvents, mockDelayAssistantItemAddedMs);
              } else {
                sendAssistantEvents();
              }
            }
          }
          if (msg.type === 'session.update') {
            receivedSessionUpdatePayloads.push(msg as typeof receivedSessionUpdatePayloads[number]);
            // Debug: log when mock receives session.update and which follow-up path is taken (for itMockOnly function-call tests).
            const debugMock = process.env.DEBUG_OPENAI_PROXY_INTEGRATION === '1';
            if (debugMock) {
              process.stdout.write(
                `[mock] session.update received; flags: FCR=${mockSendFunctionCallAfterSession} transcriptOnly=${mockSendTranscriptOnlyAfterSession} outputTextOnly=${mockSendOutputTextOnlyAfterSession} transcriptThenFCR=${mockSendTranscriptThenFunctionCallAfterSession}\n`,
              );
            }
            const sendSessionUpdated = () => {
              socket.send(JSON.stringify({ type: 'session.updated', session: { type: 'realtime' } }));
              sessionUpdatedSent = true;
              if (debugMock) process.stdout.write('[mock] sent session.updated\n');
            };
            if (mockEnforceSessionBeforeContext) {
              setTimeout(() => {
                sendSessionUpdated();
                if (mockSendUnmappedEventAfterSessionUpdated) {
                  mockSendUnmappedEventAfterSessionUpdated = false;
                  socket.send(JSON.stringify({ type: 'conversation.created', conversation: { id: 'conv_1', items: [] } }));
                }
              }, 50);
            } else {
              sendSessionUpdated();
              if (mockSendUnmappedEventAfterSessionUpdated) {
                mockSendUnmappedEventAfterSessionUpdated = false;
                socket.send(JSON.stringify({ type: 'conversation.created', conversation: { id: 'conv_1', items: [] } }));
              }
            }
            if (mockSendTranscriptThenFunctionCallAfterSession) {
              mockSendTranscriptThenFunctionCallAfterSession = false;
              socket.send(JSON.stringify({
                type: 'response.output_audio_transcript.done',
                response_id: 'resp_1',
                item_id: 'item_1',
                output_index: 0,
                content_index: 0,
                transcript: 'Function call: get_current_time()',
              }));
              socket.send(JSON.stringify({
                type: 'response.function_call_arguments.done',
                call_id: 'call_mock_1',
                name: 'get_current_time',
                arguments: '{}',
              }));
              if (debugMock) process.stdout.write('[mock] sent transcript.done + function_call_arguments.done (transcriptThenFCR)\n');
            } else if (mockSendTranscriptOnlyAfterSession) {
              mockSendTranscriptOnlyAfterSession = false;
              socket.send(JSON.stringify({
                type: 'response.output_audio_transcript.done',
                response_id: 'resp_1',
                item_id: 'item_1',
                output_index: 0,
                content_index: 0,
                transcript: 'Function call: get_current_datetime({ })',
              }));
              if (debugMock) process.stdout.write('[mock] sent output_audio_transcript.done only (transcriptOnly)\n');
            } else if (mockSendOutputTextOnlyAfterSession) {
              mockSendOutputTextOnlyAfterSession = false;
              socket.send(JSON.stringify({
                type: 'response.output_text.done',
                response_id: 'resp_1',
                item_id: 'item_1',
                output_index: 0,
                content_index: 0,
                text: 'Function call: get_current_datetime({ })',
              }));
              if (debugMock) process.stdout.write('[mock] sent output_text.done only (outputTextOnly)\n');
            } else if (mockSendTranscriptionDeltasForAccumulator) {
              mockSendTranscriptionDeltasForAccumulator = false;
              const itemId = 'item_accum_497';
              const deltas = ['Hel', 'lo ', 'world'];
              for (const delta of deltas) {
                socket.send(JSON.stringify({
                  type: 'conversation.item.input_audio_transcription.delta',
                  item_id: itemId,
                  content_index: 0,
                  delta,
                }));
              }
              if (debugMock) process.stdout.write('[mock] sent 3 input_audio_transcription.delta for Issue #497\n');
            } else if (mockSendTranscriptionCompletedWithActuals) {
              mockSendTranscriptionCompletedWithActuals = false;
              setImmediate(() => {
                socket.send(JSON.stringify({
                  type: 'conversation.item.input_audio_transcription.completed',
                  item_id: 'item_496',
                  content_index: 0,
                  transcript: 'Hello world',
                  start: 1.5,
                  duration: 2.25,
                  channel: 1,
                  channel_index: [1],
                }));
              });
              if (debugMock) process.stdout.write('[mock] sent input_audio_transcription.completed with actuals for Issue #496\n');
            } else if (mockSendConversationItemAddedFunctionCallOnly) {
              mockSendConversationItemAddedFunctionCallOnly = false;
              setImmediate(() => {
                socket.send(JSON.stringify({
                  type: 'conversation.item.added',
                  item: {
                    id: 'item_fc_499',
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'function_call', name: 'get_current_time', arguments: '{}', call_id: 'call_499' }],
                  },
                }));
              });
              if (debugMock) process.stdout.write('[mock] sent conversation.item.added (function_call only) for Issue #499\n');
            } else if (mockSendFunctionCallAfterSession) {
              mockSendFunctionCallAfterSession = false;
              socket.send(JSON.stringify({
                type: 'response.function_call_arguments.done',
                call_id: 'call_mock_1',
                name: 'get_current_time',
                arguments: '{}',
              }));
              if (debugMock) process.stdout.write('[mock] sent response.function_call_arguments.done only (FCR)\n');
            }
          }
          if (msg.type === 'response.create') {
            // Issue #414 TDD: protocol enforcement — response.create must not arrive before all items are acknowledged
            if (mockEnforceAllItemsAckedBeforeResponseCreate && itemAckedCount < itemCreateCount) {
              protocolErrors.push(new Error(
                `response.create received before all items acknowledged: acked ${itemAckedCount}/${itemCreateCount} items. ` +
                'Counter may have double-decremented (.added + .done both consumed the counter for the same item).'
              ));
            }
            // Issue #414 TDD: simulate real OpenAI behavior — error on response.create after assistant item (greeting)
            if (mockSendErrorOnAssistantResponseCreate && lastItemCreateRole === 'assistant') {
              socket.send(JSON.stringify({
                type: 'error',
                error: {
                  message: 'The server had an error while processing your request. Sorry about that! Please contact us through our help center at help.openai.com if the error persists. (include session ID in your message: sess_mock). We recommend you retry your request. You can continue or reconnect.',
                  code: 'server_error',
                },
              }));
              return; // No normal response — matches real API behavior
            }
            const MOCK_RESPONSE_TEXT = 'Hello from mock';
            const sendAssistantItemDone = () => {
              socket.send(JSON.stringify({
                type: 'conversation.item.done',
                item: {
                  id: 'item_mock_response_1',
                  type: 'message',
                  status: 'completed',
                  role: 'assistant',
                  content: [{ type: 'output_text', text: MOCK_RESPONSE_TEXT }],
                },
              }));
            };
            const sendResponseDone = () => {
              if (mockSendOutputAudioBeforeText || mockSendAudioDeltaOnGreetingResponseCreate) {
                if (mockSendOutputAudioBeforeText) mockSendOutputAudioBeforeText = false;
                if (mockSendAudioDeltaOnGreetingResponseCreate) mockSendAudioDeltaOnGreetingResponseCreate = false;
                const pcmChunk = Buffer.alloc(320, 0);
                socket.send(JSON.stringify({ type: 'response.output_audio.delta', delta: pcmChunk.toString('base64') }));
                socket.send(JSON.stringify({ type: 'response.output_audio.done' }));
              }
              socket.send(JSON.stringify({ type: 'response.output_text.done', text: MOCK_RESPONSE_TEXT }));
              sendAssistantItemDone();
            };
            // Issue #482: upstream sends idle_timeout before output_text.done (voice-commerce #956 scenario).
            if (mockSendIdleTimeoutBeforeOutputTextDone) {
              mockSendIdleTimeoutBeforeOutputTextDone = false;
              socket.send(JSON.stringify({ type: 'response.output_text.done', text: MOCK_RESPONSE_TEXT }));
              sendAssistantItemDone();
              socket.send(JSON.stringify({
                type: 'error',
                error: { code: 'idle_timeout', message: 'Session closed due to idle timeout' },
              }));
              return;
            }
            // Issue #462: send only output_audio.done first; send output_text.done after delay so test can send Settings in between.
            if (mockSendOnlyAudioDoneFirst) {
              mockSendOnlyAudioDoneFirst = false;
              const delayMs = mockDelayOutputTextDoneAfterAudioMs;
              mockDelayOutputTextDoneAfterAudioMs = 300;
              const pcmChunk = Buffer.alloc(320, 0);
              socket.send(JSON.stringify({ type: 'response.output_audio.delta', delta: pcmChunk.toString('base64') }));
              socket.send(JSON.stringify({ type: 'response.output_audio.done' }));
              setTimeout(() => {
                socket.send(JSON.stringify({ type: 'response.output_text.done', text: MOCK_RESPONSE_TEXT }));
                sendAssistantItemDone();
              }, delayMs);
              return;
            }
            if (mockDelayResponseDoneMs > 0) {
              const delay = mockDelayResponseDoneMs;
              mockDelayResponseDoneMs = 0;
              setTimeout(sendResponseDone, delay);
            } else {
              sendResponseDone();
            }
          }
          if (msg.type === 'input_audio_buffer.commit') {
            socket.send(JSON.stringify({ type: 'input_audio_buffer.committed' }));
          }
        } catch {
          // ignore
        }
      });
    });

    // Proxy created with default options (no greetingTextOnly); matches production when that TODO is removed.
    // Issue #462: pass LOG_LEVEL so capture runs can emit proxy debug logs.
    createOpenAIProxyServer({
      server: proxyServer,
      path: PROXY_PATH,
      upstreamUrl: `ws://localhost:${mockPort}`,
      logLevel: process.env.LOG_LEVEL ?? undefined,
    });
  });

  afterAll(async () => {
    if (mockWss) mockWss.close();
    if (mockUpstreamServer) await new Promise<void>((resolve) => mockUpstreamServer!.close(() => resolve()));
    if (proxyServer) {
      // Force-close any remaining client connections so server.close() can complete (avoids TCPSERVERWRAP open handle). Node 18.2+. Protocol-agnostic (HTTP/HTTPS).
      if ('closeAllConnections' in proxyServer && typeof (proxyServer as { closeAllConnections?: () => void }).closeAllConnections === 'function') {
        (proxyServer as { closeAllConnections: () => void }).closeAllConnections();
      }
      await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
    }
  }, 60000);

  beforeEach(() => {
    // Global setup (tests/setup.js) enables fake timers before every test. This suite runs the real proxy
    // and real WebSocket servers in-process; the proxy uses setTimeout and the ws/net stack relies on real
    // timers. With fake timers those never fire and mock round-trips hang. We must use real timers for every
    // test in this suite (both mock and real-API runs)—a constraint of the code under test.
    jest.useRealTimers();
    if (useRealAPIs) {
      // Stream test name so real-API runs show progress (Jest default reporter does not print names until test completes).
      const name = (typeof expect.getState === 'function' && expect.getState().currentTestName) || 'unknown';
      process.stdout.write(`[openai-proxy-integration] Running: ${name}\n`);
    }
    // Issue #470: reset so tests that expect output_text.done (e.g. "Hello from mock") are not affected by the response.done-only test.
    mockSendResponseDoneOnlyAfterFunctionCallOutput = false;
  });


  it('listens on configured path and accepts WebSocket upgrade', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      expect(client.readyState).toBe(1); // OPEN
      client.close();
      done();
    });
    client.on('error', done);
  });

  /**
   * OpenAI proxy → connected: client connecting to the proxy reaches open state.
   * The component sets connection-status "connected" on WebSocket onopen; this test asserts
   * the proxy accepts the connection so a real client (e.g. the component) would see open
   * and thus show "connected". Catches regressions in the connection path for the OpenAI provider.
   */
  it('client connecting to OpenAI proxy reaches open state (component connection-status "connected")', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
      done();
    });
    client.on('error', (err) => done(err));
  });

  /**
   * Issue #489 PROTOCOL-ASSURANCE-GAPS: With real API, client receives SettingsApplied within N s of connect.
   * Asserts proxy received session.updated from upstream (effect: client gets SettingsApplied). USE_REAL_APIS=1.
   */
  (useRealAPIs ? it : it.skip)('Issue #489 real-API: client receives SettingsApplied within 10s of connect (session.updated)', (done) => {
    const DEADLINE_MS = 10000;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string };
        if (msg.type === 'SettingsApplied') {
          finish();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => finish(err));
    setTimeout(() => {
      if (!finished) finish(new Error('Issue #489: did not receive SettingsApplied within 10s'));
    }, DEADLINE_MS);
  }, 15000);

  it('translates Settings to session.update and session.updated to SettingsApplied', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Help.' } },
      }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string };
        if (msg.type === 'Error') {
          client.close();
          done(new Error(`Upstream error (regression): ${msg.description ?? 'unknown'}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          expect(msg.type).toBe('SettingsApplied');
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', done);
  });

  /**
   * Issue #414: When upstream sends error, proxy must forward it so the client receives type: 'Error'.
   * Mock sends session.updated then error; we assert the client receives the Error (test passes).
   * Real-API tests fail when they receive any Error (done(err)); this test only verifies the proxy path.
   */
  itMockOnly('when upstream sends error after session.updated, client receives Error (proxy forwards error)', (done) => {
    let mockSocket: import('ws') | null = null;
    const originalConnection = mockWss!.listeners('connection')[0] as (socket: import('ws')) => void;
    mockWss!.removeAllListeners('connection');
    mockWss!.on('connection', (socket: import('ws')) => {
      mockSocket = socket;
      originalConnection(socket);
    });
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    let errorReceived: string | null = null;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string };
        if (msg.type === 'Error') {
          if (finished) return;
          finished = true;
          errorReceived = msg.description ?? 'unknown';
          expect(errorReceived).toContain('server had an error');
          try { client.close(); } catch { /* ignore */ }
          done();
          return;
        }
        if (msg.type === 'SettingsApplied') {
          setTimeout(() => {
            mockSocket?.send(JSON.stringify({
              type: 'error',
              error: { message: 'The server had an error while processing your request.', code: 'server_error' },
            }));
          }, 50);
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => done(err));
    setTimeout(() => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (errorReceived === null) {
        done(new Error('Expected to receive Error from proxy (proxy may not be forwarding upstream error)'));
      } else {
        done();
      }
    }, 5000);
  });

  /**
   * Issue #489 TDD: When upstream sends error with structured error.code, proxy forwards that code to client (codes over message text).
   */
  itMockOnly('when upstream sends error with error.code idle_timeout, client receives Error with code idle_timeout', (done) => {
    let mockSocket: import('ws') | null = null;
    const originalConnection = mockWss!.listeners('connection')[0] as (socket: import('ws')) => void;
    mockWss!.removeAllListeners('connection');
    mockWss!.on('connection', (socket: import('ws')) => {
      mockSocket = socket;
      originalConnection(socket);
    });
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; code?: string };
        if (msg.type === 'Error') {
          if (finished) return;
          finished = true;
          expect(msg.code).toBe('idle_timeout');
          try { client.close(); } catch { /* ignore */ }
          done();
          return;
        }
        if (msg.type === 'SettingsApplied') {
          setTimeout(() => {
            mockSocket?.send(JSON.stringify({
              type: 'error',
              error: { code: 'idle_timeout', message: 'Session closed due to idle timeout' },
            }));
          }, 50);
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => done(err));
    setTimeout(() => {
      if (!finished) {
        finished = true;
        try { client.close(); } catch { /* ignore */ }
        done(new Error('Expected to receive Error with code idle_timeout'));
      }
    }, 5000);
  });

  itMockOnly('when upstream sends error with error.code session_max_duration, client receives Error with code session_max_duration', (done) => {
    let mockSocket: import('ws') | null = null;
    const originalConnection = mockWss!.listeners('connection')[0] as (socket: import('ws')) => void;
    mockWss!.removeAllListeners('connection');
    mockWss!.on('connection', (socket: import('ws')) => {
      mockSocket = socket;
      originalConnection(socket);
    });
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; code?: string };
        if (msg.type === 'Error') {
          if (finished) return;
          finished = true;
          expect(msg.code).toBe('session_max_duration');
          try { client.close(); } catch { /* ignore */ }
          done();
          return;
        }
        if (msg.type === 'SettingsApplied') {
          setTimeout(() => {
            mockSocket?.send(JSON.stringify({
              type: 'error',
              error: { code: 'session_max_duration', message: 'Your session hit the maximum duration of 60 minutes.' },
            }));
          }, 50);
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => done(err));
    setTimeout(() => {
      if (!finished) {
        finished = true;
        try { client.close(); } catch { /* ignore */ }
        done(new Error('Expected to receive Error with code session_max_duration'));
      }
    }, 5000);
  });

  /**
   * Issue #414 COMPONENT-PROXY-INTERFACE-TDD: When upstream sends input_audio_buffer.speech_started,
   * proxy must send to client a message with type UserStartedSpeaking (component contract). See docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md §2.1.
   */
  itMockOnly('when upstream sends input_audio_buffer.speech_started, client receives UserStartedSpeaking', (done) => {
    let mockSocket: import('ws') | null = null;
    const originalConnection = mockWss!.listeners('connection')[0] as (socket: import('ws')) => void;
    mockWss!.removeAllListeners('connection');
    mockWss!.on('connection', (socket: import('ws')) => {
      mockSocket = socket;
      originalConnection(socket);
    });
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const timeoutId = setTimeout(() => done(new Error('Timeout: did not receive UserStartedSpeaking')), 5000);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string };
        if (msg.type === 'Error') {
          clearTimeout(timeoutId);
          client.close();
          done(new Error(`Upstream error: ${msg.description ?? 'unknown'}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          setImmediate(() => mockSocket?.send(JSON.stringify({ type: 'input_audio_buffer.speech_started' })));
          return;
        }
        if (msg.type === 'UserStartedSpeaking') {
          clearTimeout(timeoutId);
          expect(msg.type).toBe('UserStartedSpeaking');
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => { clearTimeout(timeoutId); done(err); });
  });

  /**
   * Issue #414 COMPONENT-PROXY-INTERFACE-TDD: When upstream sends input_audio_buffer.speech_stopped,
   * proxy must send to client UtteranceEnd with channel and last_word_end (component contract). See docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md §2.1.
   */
  itMockOnly('when upstream sends input_audio_buffer.speech_stopped, client receives UtteranceEnd with channel and last_word_end', (done) => {
    let mockSocket: import('ws') | null = null;
    const originalConnection = mockWss!.listeners('connection')[0] as (socket: import('ws')) => void;
    mockWss!.removeAllListeners('connection');
    mockWss!.on('connection', (socket: import('ws')) => {
      mockSocket = socket;
      originalConnection(socket);
    });
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const timeoutId = setTimeout(() => done(new Error('Timeout: did not receive UtteranceEnd')), 5000);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string; channel?: number[]; last_word_end?: number };
        if (msg.type === 'Error') {
          clearTimeout(timeoutId);
          client.close();
          done(new Error(`Upstream error: ${msg.description ?? 'unknown'}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          setImmediate(() => mockSocket?.send(JSON.stringify({ type: 'input_audio_buffer.speech_stopped' })));
          return;
        }
        if (msg.type === 'UtteranceEnd') {
          clearTimeout(timeoutId);
          expect(msg.type).toBe('UtteranceEnd');
          expect(Array.isArray(msg.channel)).toBe(true);
          expect(typeof msg.last_word_end).toBe('number');
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => { clearTimeout(timeoutId); done(err); });
  });

  /**
   * Issue #494: When upstream sends input_audio_buffer.speech_stopped with channel and last_word_end,
   * proxy must pass those values through to UtteranceEnd (not fixed defaults).
   */
  itMockOnly('Issue #494: when upstream sends speech_stopped with channel and last_word_end, client receives UtteranceEnd with those values', (done) => {
    let mockSocket: import('ws') | null = null;
    const originalConnection = mockWss!.listeners('connection')[0] as (socket: import('ws')) => void;
    mockWss!.removeAllListeners('connection');
    mockWss!.on('connection', (socket: import('ws')) => {
      mockSocket = socket;
      originalConnection(socket);
    });
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const timeoutId = setTimeout(() => done(new Error('Issue #494: timeout, did not receive UtteranceEnd')), 5000);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string; channel?: number[]; last_word_end?: number };
        if (msg.type === 'Error') {
          clearTimeout(timeoutId);
          client.close();
          done(new Error(`Upstream error: ${msg.description ?? 'unknown'}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          setImmediate(() => mockSocket?.send(JSON.stringify({
            type: 'input_audio_buffer.speech_stopped',
            channel: [0],
            last_word_end: 1.5,
          })));
          return;
        }
        if (msg.type === 'UtteranceEnd') {
          clearTimeout(timeoutId);
          expect(msg.channel).toEqual([0]);
          expect(msg.last_word_end).toBe(1.5);
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => { clearTimeout(timeoutId); done(err); });
  });

  /**
   * Issue #459: Proxy must NOT send session.update to upstream while the API has an active response.
   * Otherwise OpenAI returns conversation_already_has_active_response. Scenario: client sends
   * InjectUserMessage first (no Settings), proxy sends item.create → mock sends item.added →
   * proxy sends response.create (response now active). Before response completes, client sends
   * Settings. Proxy must not send session.update until response is done (or treat as duplicate).
   * TDD red: current proxy sends session.update when it receives that Settings → assert fails.
   */
  itMockOnly('Issue #459: does not send session.update while response is active (conversation_already_has_active_response)', (done) => {
    mockReceived.length = 0;
    receivedSessionUpdatePayloads.length = 0;
    mockDelayResponseDoneMs = 300;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Hi' }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          mockDelayResponseDoneMs = 0;
          const responseCreateIdx = mockReceived.findIndex((m) => m.type === 'response.create');
          const sessionUpdateAfterResponse = responseCreateIdx >= 0 && mockReceived.slice(responseCreateIdx + 1).some((m) => m.type === 'session.update');
          expect(sessionUpdateAfterResponse).toBe(false);
          client.close();
          done();
        }
      } catch (e) {
        mockDelayResponseDoneMs = 0;
        done(e as Error);
      }
    });
    setTimeout(() => {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    }, 50);
    client.on('error', (err) => {
      mockDelayResponseDoneMs = 0;
      done(err);
    });
  }, 5000);

  /**
   * Issue #462: Proxy must NOT clear responseInProgress on response.output_audio.done alone. If the real API
   * sends output_audio.done before output_text.done, clearing on audio.done would allow a subsequent Settings
   * to trigger session.update while the API still has an active response → conversation_already_has_active_response.
   * Runs with both mock and real API. Mock: session.updated on connect; client InjectUserMessage; mock sends
   * audio.done then (after delay) text.done; client sends Settings in between; assert mock receives 0 session.update.
   * Real API: Settings, InjectUserMessage, then second Settings after short delay; assert no Error containing
   * conversation_already_has_active_response.
   */
  it('Issue #462: does not send session.update after output_audio.done until output_text.done (responseInProgress not cleared on audio.done alone)', (done) => {
    let client: InstanceType<typeof WebSocket>;
    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (!useRealAPIs) mockSendSessionUpdatedOnConnect = false;
      try { client?.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };

    if (useRealAPIs) {
      // Real API: proxy → live OpenAI. Send Settings, InjectUserMessage, then Settings again during response window; assert no conversation_already_has_active_response.
      client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
      const errorsReceived: string[] = [];
      let secondSettingsSent = false;

      client.on('open', () => {
        client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
      });
      client.on('message', (data: Buffer) => {
        if (data.length === 0 || data[0] !== 0x7b) return;
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; description?: string; role?: string };
          if (msg.type === 'Error' && msg.description) {
            errorsReceived.push(msg.description);
            if (msg.description.includes('conversation_already_has_active_response')) {
              finish(new Error(`Issue #462 regression: received conversation_already_has_active_response: ${msg.description}`));
              return;
            }
          }
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say exactly: OK' }));
            // Send second Settings shortly after to try to hit the response-in-progress window (real API may send audio.done before text.done).
            setTimeout(() => {
              if (client.readyState === WebSocket.OPEN && !secondSettingsSent) {
                secondSettingsSent = true;
                client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
              }
            }, 150);
          }
          if (msg.type === 'ConversationText' && msg.role === 'assistant') {
            const bad = errorsReceived.some((d) => d.includes('conversation_already_has_active_response'));
            if (bad) {
              finish(new Error(`Issue #462 regression: received conversation_already_has_active_response before completion`));
              return;
            }
            setTimeout(() => finish(), 2000);
          }
        } catch (e) {
          finish(e as Error);
        }
      });
      client.on('error', (err) => finish(err));
      setTimeout(() => {
        if (!finished) finish(new Error('Issue #462 real-API: timeout waiting for assistant response'));
      }, 25000);
      return;
    }

    // Mock path
    mockReceived.length = 0;
    mockSendSessionUpdatedOnConnect = true;
    mockSendOnlyAudioDoneFirst = true;
    mockDelayOutputTextDoneAfterAudioMs = 300;
    client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Hi' }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type === 'ConversationText' && msg.role === 'user') {
          setTimeout(() => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
            }
          }, 50);
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          const sessionUpdateCount = mockReceived.filter((m) => m.type === 'session.update').length;
          expect(sessionUpdateCount).toBe(0);
          finish();
        }
      } catch (e) {
        finish(e as Error);
      }
    });
    client.on('error', (err) => finish(err));
  }, useRealAPIs ? 30000 : 5000);

  /**
   * Issue #470 / TDD-PLAN-MISSING-REQUIREMENTS Phase 2: Real-API integration test for Req 1 (session.update
   * only when no active response). Sends Settings, InjectUserMessage, then second Settings during response
   * window; asserts no conversation_already_has_active_response. Proxy must not send session.update while
   * response is active.
   */
  (useRealAPIs ? it : it.skip)('Issue #470 real-API: session.update not sent while response active (Req 1, USE_REAL_APIS=1)', (done) => {
    let finished = false;
    const errorsReceived: string[] = [];
    let secondSettingsSent = false;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };

    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string; role?: string };
        if (msg.type === 'Error' && msg.description) {
          errorsReceived.push(msg.description);
          if (msg.description.includes('conversation_already_has_active_response')) {
            finish(new Error(`Req 1 regression: conversation_already_has_active_response: ${msg.description}`));
            return;
          }
        }
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say exactly: OK' }));
          setTimeout(() => {
            if (client.readyState === WebSocket.OPEN && !secondSettingsSent) {
              secondSettingsSent = true;
              client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
            }
          }, 150);
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          if (errorsReceived.some((d) => d.includes('conversation_already_has_active_response'))) {
            finish(new Error('Req 1 regression: conversation_already_has_active_response before completion'));
            return;
          }
          setTimeout(() => finish(), 2000);
        }
      } catch (e) {
        finish(e as Error);
      }
    });
    client.on('error', (err) => finish(err));
    setTimeout(() => {
      if (!finished) finish(new Error('Issue #470 real-API Req 1: timeout waiting for assistant response'));
    }, 25000);
  }, 30000);

  /**
   * Issue #470 / TDD-PLAN-MISSING-REQUIREMENTS Phase 3: Real-API test for Req 3 (response.create only
   * after item.added). Sends Settings, InjectUserMessage; asserts we receive ConversationText (assistant)
   * without any Error. If proxy sent response.create before item.added, the real API could error.
   */
  (useRealAPIs ? it : it.skip)('Issue #470 real-API: InjectUserMessage receives assistant response without error (Req 3, USE_REAL_APIS=1)', (done) => {
    let finished = false;
    const errorsReceived: string[] = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };

    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string; role?: string; content?: string };
        if (msg.type === 'Error' && msg.description) {
          errorsReceived.push(msg.description);
          finish(new Error(`Req 3: upstream error before response: ${msg.description}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is 2 plus 2?' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          if (errorsReceived.length > 0) {
            finish(new Error(`Req 3: received errors before assistant response: ${errorsReceived.join('; ')}`));
            return;
          }
          expect(typeof msg.content).toBe('string');
          expect((msg.content ?? '').length).toBeGreaterThan(0);
          setTimeout(() => finish(), 1000);
        }
      } catch (e) {
        finish(e as Error);
      }
    });
    client.on('error', (err) => finish(err));
    timeoutId = setTimeout(() => setImmediate(() => {
      if (!finished) finish(new Error('Issue #470 real-API Req 3: timeout waiting for assistant response'));
    }), 25000);
  }, 30000);

  /**
   * Issue #489 PROTOCOL-ASSURANCE-GAPS: With real API, after InjectUserMessage client receives ConversationText
   * (assistant) and AgentAudioDone. Asserts proxy received completion (response.done / output_text.done).
   * USE_REAL_APIS=1.
   */
  (useRealAPIs ? it : it.skip)('Issue #489 real-API: InjectUserMessage receives ConversationText (assistant) and AgentAudioDone', (done) => {
    let finished = false;
    let gotConversationText = false;
    let gotAgentAudioDone = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string; description?: string };
        if (msg.type === 'Error' && msg.description) {
          finish(new Error(`Upstream error: ${msg.description}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is 2 plus 2?' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          gotConversationText = true;
          if (typeof msg.content === 'string') expect(msg.content.length).toBeGreaterThan(0);
        }
        if (msg.type === 'AgentAudioDone') {
          gotAgentAudioDone = true;
        }
        if (gotConversationText && gotAgentAudioDone) {
          finish();
        }
      } catch (e) {
        finish(e as Error);
      }
    });
    client.on('error', (err) => finish(err));
    timeoutId = setTimeout(() => setImmediate(() => {
      if (!finished) {
        finish(new Error(
          `Issue #489: timeout; gotConversationText=${gotConversationText} gotAgentAudioDone=${gotAgentAudioDone}`,
        ));
      }
    }), 30000);
  }, 35000);

  /**
   * Reconnect/reload: when client sends Settings twice (e.g. test-app focus or reload), proxy must forward
   * only the first session.update to upstream. A second session.update can cause upstream (OpenAI) to return
   * "The server had an error while processing your request." This test reproduces the duplicate-Settings
   * scenario and asserts the mock receives exactly one session.update.
   */
  itMockOnly('forwards only first Settings per connection (duplicate Settings get SettingsApplied but no second session.update)', (done) => {
    mockReceived.length = 0;
    let settingsAppliedCount = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        settingsAppliedCount++;
        if (settingsAppliedCount === 1) {
          client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Help.' } } }));
        } else if (settingsAppliedCount === 2) {
          const sessionUpdateCount = mockReceived.filter((m) => m.type === 'session.update').length;
          expect(sessionUpdateCount).toBe(1);
          client.close();
          done();
        }
      }
    });
    client.on('error', done);
  });

  it('translates InjectUserMessage to conversation.item.create + response.create and response.output_text.done to ConversationText', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      // Real API can send binary PCM (response.output_audio.delta); skip non-JSON
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; content?: string; role?: string; description?: string };
        if (msg.type === 'Error') {
          finish(new Error(`Upstream error (regression): ${msg.description ?? 'unknown'}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is 2 plus 2?' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          if (useRealAPIs) {
            expect(typeof msg.content).toBe('string');
            expect((msg.content ?? '').length).toBeGreaterThan(0);
          } else {
            expect(msg.content).toBe('Hello from mock');
          }
          if (useRealAPIs) {
            // Real API can send error after response; wait so receiving Error fails the test (5s window)
            setTimeout(() => finish(), 5000);
          } else {
            finish();
          }
        }
      } catch {
        // ignore parse errors (e.g. truncated)
      }
    });
    client.on('error', (err) => finish(err));
  }, useRealAPIs ? 25000 : 5000);

  /** Issue #414: OpenAI requires ≥100ms audio before commit. Proxy must not send commit when total appended bytes < 100ms (4800 bytes at 24kHz 16-bit; proxy uses 24k so both 16k and 24k clients work). */
  itMockOnly('does not send input_audio_buffer.commit when total appended audio < 100ms (Issue #414 buffer too small)', (done) => {
    mockReceived.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        client.send(Buffer.alloc(500, 0));
        setTimeout(() => {
          const types = mockReceived.map((m) => m.type);
          expect(types).toContain('input_audio_buffer.append');
          expect(types).not.toContain('input_audio_buffer.commit');
          client.close();
          done();
        }, 400);
      }
    });
    client.on('error', done);
  }, 5000);

  /**
   * Issue #414: Proxy must not send input_audio_buffer.append until after session.updated (audio gated).
   * When client sends binary before session.updated, proxy queues it and flushes after session.updated.
   * Mock enforces protocol: input_audio_buffer.append before session.updated → protocolErrors.
   * This test delays session.updated (mockEnforceSessionBeforeContext); client sends Settings then binary
   * immediately. We assert no append before session.updated (30ms), then order and no protocol errors.
   */
  itMockOnly('Issue #414: no input_audio_buffer.append before session.updated (audio gated, queued then flushed)', (done) => {
    mockReceived.length = 0;
    protocolErrors.length = 0;
    mockEnforceSessionBeforeContext = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
      setImmediate(() => client.send(Buffer.alloc(960, 0)));
    });
    setTimeout(() => {
      const types = mockReceived.map((m) => m.type);
      expect(types.filter((t) => t === 'input_audio_buffer.append')).toHaveLength(0);
    }, 30);
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string };
        if (msg.type === 'SettingsApplied') {
          setTimeout(() => {
            expect(protocolErrors).toHaveLength(0);
            const types = mockReceived.map((m) => m.type);
            expect(types).toContain('session.update');
            expect(types).toContain('input_audio_buffer.append');
            const sessionUpdateIdx = types.indexOf('session.update');
            const firstAppendIdx = types.indexOf('input_audio_buffer.append');
            expect(sessionUpdateIdx).toBeLessThan(firstAppendIdx);
            mockEnforceSessionBeforeContext = false;
            client.close();
            done();
          }, 80);
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => {
      mockEnforceSessionBeforeContext = false;
      done(err);
    });
  }, 5000);

  /**
   * Issue #414: Upstream message order — session.update must appear before any input_audio_buffer.append.
   * Client sends binary only after SettingsApplied; proxy must have sent session.update first.
   * Mock enforces protocol: append before session.updated → protocolErrors; we assert none.
   */
  itMockOnly('Issue #414: session.update before input_audio_buffer.append in upstream order', (done) => {
    mockReceived.length = 0;
    protocolErrors.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string };
        if (msg.type === 'SettingsApplied') {
          client.send(Buffer.alloc(960, 0));
          setTimeout(() => {
            expect(protocolErrors).toHaveLength(0);
            const types = mockReceived.map((m) => m.type);
            const sessionUpdateIdx = types.indexOf('session.update');
            const firstAppendIdx = types.indexOf('input_audio_buffer.append');
            expect(sessionUpdateIdx).toBeGreaterThanOrEqual(0);
            expect(firstAppendIdx).toBeGreaterThanOrEqual(0);
            expect(sessionUpdateIdx).toBeLessThan(firstAppendIdx);
            client.close();
            done();
          }, 100);
        }
      } catch {
        // ignore
      }
    });
    client.on('error', done);
  }, 5000);

  /**
   * Issue #414: Firm audio connection — after sending audio per protocol, no Error from upstream within N seconds.
   * With mock: upstream never sends error after append, so test passes. Documents expected behavior when upstream is well-behaved.
   * See docs/issues/ISSUE-414/RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md §4.
   */
  itMockOnly('Issue #414: firm audio connection — no Error from upstream within 12s after sending audio (mock)', (done) => {
    protocolErrors.length = 0;
    const FIRM_AUDIO_WINDOW_MS = 12000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string };
        if (msg.type === 'Error') {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = null;
          client.close();
          done(new Error(
            `Received Error from proxy within firm-audio window: "${msg.description ?? 'unknown'}". ` +
            'Expected no error after sending audio per protocol (Issue #414).'
          ));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          client.send(Buffer.alloc(4800, 0)); // 100ms at 24kHz 16-bit mono
          timeoutId = setTimeout(() => {
            timeoutId = null;
            try {
              expect(protocolErrors).toHaveLength(0);
              client.close();
              done();
            } catch (err) {
              client.close();
              done(err as Error);
            }
          }, FIRM_AUDIO_WINDOW_MS);
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
    client.on('close', () => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }, 22000); // 12s firm-audio window + buffer

  /**
   * Issue #414 real-API: Same assertion as mock test. With real OpenAI, upstream currently returns error after append;
   * this test FAILS and documents the server error. When the API is fixed, it should pass.
   */
  (useRealAPIs ? it : it.skip)('Issue #414 real-API: firm audio connection — no Error from upstream within 12s after sending audio (USE_REAL_APIS=1)', (done) => {
    const FIRM_AUDIO_WINDOW_MS = 12000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let receivedSettingsApplied = false;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string };
        if (msg.type === 'SettingsApplied') {
          receivedSettingsApplied = true;
          client.send(Buffer.alloc(4800, 0));
          timeoutId = setTimeout(() => {
            timeoutId = null;
            client.close();
            done();
          }, FIRM_AUDIO_WINDOW_MS);
          return;
        }
        if (msg.type === 'Error') {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = null;
          client.close();
          done(new Error(
            `Real API returned Error within firm-audio window: "${msg.description ?? 'unknown'}". ` +
            `This documents the Issue #414 server error. (settingsApplied=${receivedSettingsApplied})`
          ));
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
    client.on('close', () => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }, 22000); // 12s firm-audio window + buffer

  /**
   * Issue #414 RESOLUTION-PLAN §7: Real-API firm audio with speech-like PCM from project fixtures.
   * Uses TTS/recorded speech (tests/fixtures/audio-samples), not synthetic tone. Varying audio content is critical.
   */
  (useRealAPIs ? it : it.skip)('Issue #414 real-API: firm audio (speech-like audio) — no Error from upstream within 12s (USE_REAL_APIS=1)', (done) => {
    const FIRM_AUDIO_WINDOW_MS = 12000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let receivedSettingsApplied = false;
    const speechLikePcm = AudioFileLoader.loadSpeechLikePcm24kFromFixture('hello', PCM_100MS_24K_BYTES);
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string };
        if (msg.type === 'SettingsApplied') {
          receivedSettingsApplied = true;
          client.send(speechLikePcm.slice(0, PCM_100MS_24K_BYTES));
          timeoutId = setTimeout(() => {
            timeoutId = null;
            client.close();
            done();
          }, FIRM_AUDIO_WINDOW_MS);
          return;
        }
        if (msg.type === 'Error') {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = null;
          client.close();
          done(new Error(
            `Real API returned Error within firm-audio window (speech-like audio): "${msg.description ?? 'unknown'}". ` +
            `(settingsApplied=${receivedSettingsApplied})`
          ));
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
    client.on('close', () => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }, 22000); // 12s firm-audio window + buffer

  itMockOnly('translates binary client message to input_audio_buffer.append and after debounce sends commit + response.create when ≥100ms audio', (done) => {
    mockReceived.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
      if (msg.type === 'SettingsApplied') {
        client.send(Buffer.alloc(4800, 0)); // 100ms at 24kHz 16-bit mono (proxy MIN_AUDIO_BYTES_FOR_COMMIT)
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

  /** Issue #414 3.2: Proxy must not send a second response.create while a response is still in progress (avoids "conversation already has an active response"). */
  itMockOnly('sends at most one response.create per turn until response completes (Issue #414 conversation_already_has_active_response)', (done) => {
    mockDelayResponseDoneMs = 600;
    mockReceived.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    // Last chunk at 250ms; proxy debounce is 400ms after last append → commit + response.create at 650ms. Wait 750ms so assertion runs after debounce.
    const LAST_CHUNK_MS = 250;
    const DEBOUNCE_MS = 400;
    const ASSERT_AFTER_MS = LAST_CHUNK_MS + DEBOUNCE_MS + 100;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        mockReceived.length = 0;
        client.send(Buffer.alloc(4800, 0));
        setTimeout(() => client.send(Buffer.alloc(4800, 0)), LAST_CHUNK_MS);
        setTimeout(() => {
          try {
            const responseCreateCount = mockReceived.filter((m) => m.type === 'response.create').length;
            expect(responseCreateCount).toBe(1);
          } finally {
            client.close();
            done();
          }
        }, ASSERT_AFTER_MS);
      }
    });
    client.on('error', done);
  }, 10000);

  /**
   * Issue #414 proxy contract: only response.output_audio.delta (decoded PCM) must be sent as binary;
   * all other upstream messages (conversation.item.added, response.output_text.done, etc.) must be sent as text.
   * Catches regression where proxy sends JSON as binary (e.g. clientWs.send(raw)) and component routes it to audio.
   * We classify "binary" as payload that does not parse as JSON with a type field (ws may deliver all as Buffer).
   */
  itMockOnly('Issue #414: only response.output_audio.delta is sent as binary; all other upstream messages as text (proxy wire contract)', (done) => {
    mockSendOutputAudioBeforeText = true;
    const receivedFrames: Array<{ isBinary: boolean; type?: string; binaryData?: Buffer }> = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer | string) => {
      const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      let type: string | undefined;
      let role: string | undefined;
      try {
        const parsed = JSON.parse(buf.toString('utf8')) as { type?: string; role?: string };
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.type === 'string') type = parsed.type;
          if (typeof parsed.role === 'string') role = parsed.role;
        }
      } catch {
        // not JSON (e.g. binary PCM)
      }
      const isBinary = !type;
      receivedFrames.push({
        isBinary,
        type,
        binaryData: isBinary ? (buf as Buffer) : undefined,
      });
      if (type === 'SettingsApplied') {
        client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is 2 plus 2?' }));
      }
      if (type === 'ConversationText' && role === 'assistant' && receivedFrames.some((f) => f.type === 'SettingsApplied')) {
        const binaryFrames = receivedFrames.filter((f) => f.isBinary);
        expect(binaryFrames.length).toBe(1);
        expect(receivedFrames.filter((f) => !f.isBinary).length).toBeGreaterThanOrEqual(2);
        const singleBinary = binaryFrames[0]?.binaryData;
        expect(singleBinary).toBeDefined();
        const isLikelyJson = singleBinary
          ? (() => {
              try {
                const p = JSON.parse(singleBinary.toString('utf8')) as { type?: string };
                return typeof p === 'object' && p !== null && typeof p.type === 'string';
              } catch {
                return false;
              }
            })()
          : false;
        expect(isLikelyJson).toBe(false);
        client.close();
        done();
      }
    });
    client.on('error', done);
  }, 8000);

  /**
   * Proxy must send raw PCM (binary) to the client when upstream sends response.output_audio.delta (JSON with base64).
   * So the test-app component receives binary frames and can play TTS via handleAgentAudio → AudioManager.queueAudio.
   */
  itMockOnly('sends binary PCM to client when upstream sends response.output_audio.delta (test-app TTS path)', (done) => {
    mockSendOutputAudioBeforeText = true;
    const expectedPcmBytes = 320;
    const receivedPcmChunks: Buffer[] = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const str = data.toString('utf8');
      if (data.length === expectedPcmBytes && str[0] !== '{') {
        receivedPcmChunks.push(data);
        return;
      }
      try {
        const msg = JSON.parse(str) as { type?: string; role?: string; content?: string };
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is 2 plus 2?' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          expect(receivedPcmChunks.length).toBeGreaterThanOrEqual(1);
          expect(receivedPcmChunks[0].length).toBe(expectedPcmBytes);
          client.close();
          done();
        }
      } catch {
        if (data.length === expectedPcmBytes) receivedPcmChunks.push(data);
      }
    });
    client.on('error', done);
  }, 8000);

  itMockOnly('translates response.function_call_arguments.done to FunctionCallRequest and FunctionCallResponse to conversation.item.create (function_call_output)', (done) => {
    receivedConversationItems.length = 0;
    mockSendFunctionCallAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let gotFunctionCallRequest = false;
    let sentFunctionCallResponse = false;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; functions?: Array<{ id: string; name: string }>; role?: string; content?: string };
      if (msg.type === 'FunctionCallRequest' && msg.functions?.length) {
        gotFunctionCallRequest = true;
        expect(msg.functions[0].name).toBe('get_current_time');
        expect(msg.functions[0].id).toBe('call_mock_1');
        client.send(JSON.stringify({
          type: 'FunctionCallResponse',
          id: 'call_mock_1',
          name: 'get_current_time',
          content: '{"time":"12:00"}',
        }));
        sentFunctionCallResponse = true;
      }
      // Proxy sends ConversationText (assistant) twice: first "Function call: get_current_time({})", then after mock replies with output_text.done we get "Hello from mock"
      if (msg.type === 'ConversationText' && msg.role === 'assistant' && sentFunctionCallResponse && msg.content === 'Hello from mock') {
        expect(gotFunctionCallRequest).toBe(true);
        const functionCallOutput = receivedConversationItems.find((m) => m.item?.type === 'function_call_output');
        expect(functionCallOutput).toBeDefined();
        expect(functionCallOutput?.item?.call_id).toBe('call_mock_1');
        expect(functionCallOutput?.item?.output).toBe('{"time":"12:00"}');
        client.close();
        done();
      }
    });
    client.on('error', done);
  }, 8000);

  /**
   * Issue #489: Component API sends FunctionCallResponse with { id, result } (no content). Proxy must derive
   * function_call_output from result so upstream receives stringified result; otherwise model gets empty output.
   */
  itMockOnly('maps FunctionCallResponse with result (no content) to conversation.item.create with stringified output', (done) => {
    receivedConversationItems.length = 0;
    mockSendFunctionCallAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const resultPayload = { time: '14:32:15', timezone: 'UTC' };
    let sentFunctionCallResponse = false;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; functions?: Array<{ id: string; name: string }>; role?: string; content?: string };
      if (msg.type === 'FunctionCallRequest' && msg.functions?.length) {
        expect(msg.functions[0].name).toBe('get_current_time');
        expect(msg.functions[0].id).toBe('call_mock_1');
        client.send(JSON.stringify({
          type: 'FunctionCallResponse',
          id: 'call_mock_1',
          result: resultPayload,
        }));
        sentFunctionCallResponse = true;
      }
      if (msg.type === 'ConversationText' && msg.role === 'assistant' && sentFunctionCallResponse && msg.content === 'Hello from mock') {
        const functionCallOutput = receivedConversationItems.find((m) => m.item?.type === 'function_call_output');
        expect(functionCallOutput).toBeDefined();
        expect(functionCallOutput?.item?.call_id).toBe('call_mock_1');
        expect(functionCallOutput?.item?.output).toBe(JSON.stringify(resultPayload));
        client.close();
        done();
      }
    });
    client.on('error', done);
  }, 8000);

  /**
   * Issue #487 protocol contract: Within N ms of the client sending FunctionCallResponse, the client must receive
   * at least one of AgentThinking, ConversationText (assistant), or AgentAudioDone. This allows the component to
   * clear "waiting for next agent message" and re-enable the idle timer. Catches proxy regressions (e.g. removing
   * the AgentThinking send after function result). See docs/issues/ISSUE-489/WHY-INTEGRATION-TESTS-MISS-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md.
   */
  itMockOnly('Issue #487: within 2s of FunctionCallResponse client receives AgentThinking or ConversationText (assistant) or AgentAudioDone', (done) => {
    mockSendFunctionCallAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let sentFunctionCallResponseAt: number | null = null;
    let finished = false;
    const CONTRACT_DEADLINE_MS = 2000;

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };

    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });

    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type === 'FunctionCallRequest') {
          client.send(JSON.stringify({
            type: 'FunctionCallResponse',
            id: 'call_mock_1',
            name: 'get_current_time',
            content: '{"time":"12:00"}',
          }));
          sentFunctionCallResponseAt = Date.now();
          return;
        }
        if (sentFunctionCallResponseAt === null) return;
        const elapsed = Date.now() - sentFunctionCallResponseAt;
        if (elapsed > CONTRACT_DEADLINE_MS) return;
        const isAcceptable =
          msg.type === 'AgentThinking' ||
          msg.type === 'AgentAudioDone' ||
          (msg.type === 'ConversationText' && msg.role === 'assistant');
        if (isAcceptable) {
          finish();
        }
      } catch {
        // ignore non-JSON
      }
    });

    client.on('error', (err) => finish(err));
    setTimeout(() => {
      if (finished) return;
      if (sentFunctionCallResponseAt !== null) {
        finish(new Error('Issue #487: client did not receive AgentThinking, ConversationText (assistant), or AgentAudioDone within 2s of FunctionCallResponse'));
      } else {
        finish(new Error('Issue #487: never received FunctionCallRequest'));
      }
    }, CONTRACT_DEADLINE_MS + 3000);
  }, 10000);

  /**
   * Issue #470 / #462: Real-API integration test for function-call path. Uses real HTTP to a backend (no in-test
   * hardcoded FunctionCallResponse). Partner scenario: Settings → InjectUserMessage → FunctionCallRequest →
   * POST to backend → FunctionCallResponse → response. Asserts no conversation_already_has_active_response.
   * Runs only with USE_REAL_APIS=1. See docs/issues/ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md.
   */
  (useRealAPIs ? it : it.skip)('Issue #470 real-API: function-call flow completes without conversation_already_has_active_response (USE_REAL_APIS=1)', (done) => {
    const errorsReceived: string[] = [];
    const assistantContentAfterFunctionCall: string[] = [];
    let sentFunctionCallResponse = false;
    let receivedAssistantResponseAfterFunctionCall = false;
    let finished = false;
    const timeoutMs = 60000; // Real API function-call round-trip can exceed 35s
    let functionCallBackend: { server: http.Server; port: number } | null = null;
    let client: InstanceType<typeof WebSocket> | null = null;

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (functionCallBackend) {
        try { functionCallBackend.server.close(); } catch { /* ignore */ }
        functionCallBackend = null;
      }
      try { if (client) client.close(); } catch { /* ignore */ }
      client = null;
      if (err) done(err);
      else done();
    };

    createMinimalFunctionCallBackend()
      .then((backend) => {
        functionCallBackend = backend;
        client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);

        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'Settings',
            agent: {
              think: {
                prompt: 'You are a helpful assistant. Use tools when needed.',
                functions: [
                  {
                    name: 'get_current_time',
                    description: 'Get the current time in a specific timezone.',
                    parameters: {
                      type: 'object',
                      properties: {
                        timezone: { type: 'string', description: 'Timezone (e.g. UTC, America/New_York)' },
                      },
                    },
                  },
                ],
              },
            },
          }));
        });

        client.on('message', (data: Buffer) => {
          if (data.length === 0 || data[0] !== 0x7b) return;
          try {
            const msg = JSON.parse(data.toString()) as {
              type?: string;
              description?: string;
              role?: string;
              content?: string;
              functions?: Array<{ id: string; name: string; arguments?: string }>;
            };
            if (msg.type === 'Error' && msg.description) {
              errorsReceived.push(msg.description);
              if (msg.description.includes('conversation_already_has_active_response')) {
                finish(new Error(`Issue #470 regression: received conversation_already_has_active_response: ${msg.description}`));
                return;
              }
            }
            if (msg.type === 'SettingsApplied') {
              client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What time is it?' }));
            }
            if (msg.type === 'FunctionCallRequest' && msg.functions?.length && !sentFunctionCallResponse) {
              const fn = msg.functions[0];
              const backendUrl = `http://127.0.0.1:${functionCallBackend!.port}/function-call`;
              fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: fn.id, name: fn.name, arguments: fn.arguments ?? '{}' }),
              })
                .then((res) => res.json() as Promise<{ content?: string; error?: string }>)
                .then((body) => {
                  if (body.error) {
                    finish(new Error(`Function-call backend returned error: ${body.error}`));
                    return;
                  }
                  const content = typeof body.content === 'string' ? body.content : JSON.stringify({ time: '12:00', timezone: 'UTC' });
                  client.send(JSON.stringify({
                    type: 'FunctionCallResponse',
                    id: fn.id,
                    name: fn.name,
                    content,
                  }));
                  sentFunctionCallResponse = true;
                })
                .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
            }
            if (msg.type === 'ConversationText' && msg.role === 'assistant' && sentFunctionCallResponse) {
              const bad = errorsReceived.some((d) => d.includes('conversation_already_has_active_response'));
              if (bad) {
                finish(new Error('Issue #470 regression: received conversation_already_has_active_response before assistant response'));
                return;
              }
              if (typeof msg.content === 'string') assistantContentAfterFunctionCall.push(msg.content);
              receivedAssistantResponseAfterFunctionCall = true;
              setTimeout(() => {
                // Issue #478: assert the agent's reply presents the function result to the user (backend returns time 12:00, timezone UTC).
                const includesFunctionResult = assistantContentAfterFunctionCall.some(
                  (c) => c.includes('12:00') || c.includes('UTC'),
                );
                if (!includesFunctionResult) {
                  finish(new Error(`Issue #478: assistant response did not include function result (12:00 or UTC). Received: ${assistantContentAfterFunctionCall.join(' | ')}`));
                  return;
                }
                finish();
              }, 2000);
            }
          } catch {
            // ignore non-JSON
          }
        });

        client.on('error', (err) => finish(err));
        setTimeout(() => {
          if (finished) return;
          if (!receivedAssistantResponseAfterFunctionCall) {
            const errMsg = errorsReceived.length
              ? `Timeout; errors: ${errorsReceived.join('; ')}`
              : 'Timeout waiting for assistant response after function call';
            finish(new Error(`Issue #470 real-API: ${errMsg}`));
          }
        }, timeoutMs);
      })
      .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
  }, 70000); // Jest timeout: real-API function-call flow can be slow

  /**
   * Issue #489 PROTOCOL-ASSURANCE-GAPS (essential): After client sends FunctionCallResponse, client receives
   * AgentAudioDone within timeout. Effect of proxy receiving response.done or response.output_text.done from
   * upstream. If real API never sends completion, this test fails. USE_REAL_APIS=1.
   */
  (useRealAPIs ? it : it.skip)('Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone (proxy received completion)', (done) => {
    const errorsReceived: string[] = [];
    let sentFunctionCallResponse = false;
    let receivedAgentAudioDone = false;
    let finished = false;
    const timeoutMs = 60000;
    let functionCallBackend: { server: http.Server; port: number } | null = null;
    let client: InstanceType<typeof WebSocket> | null = null;

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (functionCallBackend) {
        try { functionCallBackend.server.close(); } catch { /* ignore */ }
        functionCallBackend = null;
      }
      try { if (client) client.close(); } catch { /* ignore */ }
      client = null;
      if (err) done(err);
      else done();
    };

    createMinimalFunctionCallBackend()
      .then((backend) => {
        functionCallBackend = backend;
        client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);

        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'Settings',
            agent: {
              think: {
                prompt: 'You are a helpful assistant. Use tools when needed.',
                functions: [
                  {
                    name: 'get_current_time',
                    description: 'Get the current time in a specific timezone.',
                    parameters: {
                      type: 'object',
                      properties: {
                        timezone: { type: 'string', description: 'Timezone (e.g. UTC, America/New_York)' },
                      },
                    },
                  },
                ],
              },
            },
          }));
        });

        client.on('message', (data: Buffer) => {
          if (data.length === 0 || data[0] !== 0x7b) return;
          try {
            const msg = JSON.parse(data.toString()) as {
              type?: string;
              description?: string;
              functions?: Array<{ id: string; name: string; arguments?: string }>;
            };
            if (msg.type === 'Error' && msg.description) {
              errorsReceived.push(msg.description);
              if (msg.description.includes('conversation_already_has_active_response')) {
                finish(new Error(`Issue #489: conversation_already_has_active_response: ${msg.description}`));
                return;
              }
            }
            if (msg.type === 'SettingsApplied') {
              client!.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What time is it?' }));
            }
            if (msg.type === 'FunctionCallRequest' && msg.functions?.length && !sentFunctionCallResponse) {
              const fn = msg.functions[0];
              const backendUrl = `http://127.0.0.1:${functionCallBackend!.port}/function-call`;
              fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: fn.id, name: fn.name, arguments: fn.arguments ?? '{}' }),
              })
                .then((res) => res.json() as Promise<{ content?: string; error?: string }>)
                .then((body) => {
                  if (body.error) {
                    finish(new Error(`Function-call backend returned error: ${body.error}`));
                    return;
                  }
                  const content = typeof body.content === 'string' ? body.content : JSON.stringify({ time: '12:00', timezone: 'UTC' });
                  client!.send(JSON.stringify({
                    type: 'FunctionCallResponse',
                    id: fn.id,
                    name: fn.name,
                    content,
                  }));
                  sentFunctionCallResponse = true;
                })
                .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
            }
            if (msg.type === 'AgentAudioDone') {
              if (sentFunctionCallResponse) {
                receivedAgentAudioDone = true;
                finish();
              }
            }
          } catch {
            // ignore non-JSON
          }
        });

        client.on('error', (err) => finish(err));
        setTimeout(() => {
          if (finished) return;
          const errMsg = errorsReceived.length
            ? `Timeout; errors: ${errorsReceived.join('; ')}`
            : 'Timeout: client did not receive AgentAudioDone after FunctionCallResponse (proxy may not have received response.done/output_text.done from upstream)';
          finish(new Error(`Issue #489: ${errMsg}`));
        }, timeoutMs);
      })
      .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
  }, 70000);

  /**
   * When upstream sends response.function_call_arguments.done, proxy sends FunctionCallRequest (and AgentStartedSpeaking).
   * Issue #489 Phase 2: proxy does not map this control event to ConversationText; assistant content from conversation.item.added only.
   * This test asserts the client receives FunctionCallRequest after SettingsApplied.
   */
  itMockOnly('sends FunctionCallRequest when upstream sends response.function_call_arguments.done (client receives FCR)', (done) => {
    mockSendFunctionCallAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const receivedOrder: string[] = [];
    let finished = false;
    let lastError: Error | undefined;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      lastError = err;
      try { client.close(); } catch { /* ignore */ }
    };
    const debug = process.env.DEBUG_OPENAI_PROXY_INTEGRATION === '1';
    const t = setTimeout(() => finish(new Error('timeout: expected FunctionCallRequest')), 4000);
    client.on('close', () => {
      if (finished) {
        if (lastError) done(lastError);
        else done();
      }
    });
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
      if (debug) process.stdout.write('[client] open, sent Settings\n');
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; functions?: Array<{ id: string; name: string }>; role?: string; content?: string };
      if (msg.type) {
        receivedOrder.push(msg.type);
        if (debug) process.stdout.write(`[client] received: ${msg.type}\n`);
      }
      if (receivedOrder.includes('FunctionCallRequest')) {
        expect(receivedOrder).toContain('SettingsApplied');
        clearTimeout(t);
        finish();
      }
    });
    client.on('error', (err) => finish(err));
  }, 5000);

  /**
   * When upstream sends ONLY response.output_audio_transcript.done (no response.function_call_arguments.done),
   * proxy does not send ConversationText (Issue #489 Phase 2: control events not mapped to ConversationText).
   * Client does NOT receive FunctionCallRequest. This test asserts client gets SettingsApplied and never gets FCR.
   */
  itMockOnly('sends no FunctionCallRequest when upstream sends only output_audio_transcript.done (no FCR)', (done) => {
    mockSendTranscriptOnlyAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; content?: string }> = [];
    let finished = false;
    let lastError: Error | undefined;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      lastError = err;
      try { client.close(); } catch { /* ignore */ }
    };
    const debug = process.env.DEBUG_OPENAI_PROXY_INTEGRATION === '1';
    const t = setTimeout(() => {
      const hasFCR = received.some((m) => m.type === 'FunctionCallRequest');
      if (received.some((m) => m.type === 'SettingsApplied') && !hasFCR) finish();
      else finish(new Error(`timeout: got FCR=${hasFCR}, received: ${received.map((m) => m.type).join(', ')}`));
    }, 4000);
    client.on('close', () => {
      if (finished) {
        if (lastError) done(lastError);
        else done();
      }
    });
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
      if (debug) process.stdout.write('[client] open, sent Settings (transcriptOnly test)\n');
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
      if (msg.type) {
        received.push({ type: msg.type, content: msg.content });
        if (debug) process.stdout.write(`[client] received: ${msg.type}${msg.content ? ` content=${String(msg.content).slice(0, 50)}...` : ''}\n`);
      }
      if (received.some((m) => m.type === 'FunctionCallRequest')) {
        clearTimeout(t);
        finish(new Error('expected no FunctionCallRequest'));
        return;
      }
      // Success is asserted in the 4s timeout: SettingsApplied and no FCR
    });
    client.on('error', (err) => finish(err));
  }, 5000);

  /**
   * Issue #497: Proxy must accumulate input_audio_transcription.delta per item_id and send Transcript with accumulated text.
   * Mock sends three deltas ("Hel", "lo ", "world") for the same item_id; client must receive three Transcripts with
   * transcript "Hel", "Hello ", "Hello world" (is_final: false).
   */
  itMockOnly('Issue #497: input_audio_transcription.delta accumulated per item_id → Transcript with accumulated text', (done) => {
    mockSendTranscriptionDeltasForAccumulator = true;
    const transcripts: Array<{ transcript: string; is_final: boolean }> = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    const t = setTimeout(() => {
      try {
        expect(transcripts.length).toBe(3);
        expect(transcripts[0].transcript).toBe('Hel');
        expect(transcripts[1].transcript).toBe('Hello ');
        expect(transcripts[2].transcript).toBe('Hello world');
        transcripts.forEach((x) => expect(x.is_final).toBe(false));
        finish();
      } catch (e) {
        finish(e as Error);
      }
    }, 4000);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; transcript?: string; is_final?: boolean };
        if (msg.type === 'Transcript') {
          transcripts.push({ transcript: msg.transcript ?? '', is_final: msg.is_final ?? false });
          if (transcripts.length >= 3) {
            clearTimeout(t);
            try {
              expect(transcripts[0].transcript).toBe('Hel');
              expect(transcripts[1].transcript).toBe('Hello ');
              expect(transcripts[2].transcript).toBe('Hello world');
              transcripts.forEach((x) => expect(x.is_final).toBe(false));
              finish();
            } catch (e) {
              finish(e as Error);
            }
          }
        }
      } catch {
        // ignore
      }
    });
    client.on('close', () => {
      if (!finished) {
        clearTimeout(t);
        finish(new Error(`Issue #497: connection closed with ${transcripts.length} Transcript(s); expected 3 accumulated`));
      }
    });
    client.on('error', (err) => finish(err));
  }, 5000);

  /**
   * Issue #496: When upstream sends input_audio_transcription.completed with start, duration, channel (or channel_index),
   * proxy must pass those through to Transcript; use defaults only when API omits them.
   */
  itMockOnly('Issue #496: input_audio_transcription.completed with start/duration/channel → Transcript has actuals', (done) => {
    mockSendTranscriptionCompletedWithActuals = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    const t = setTimeout(() => {
      finish(new Error('Issue #496: timeout, did not receive Transcript with actuals'));
    }, 5000);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as {
          type?: string;
          transcript?: string;
          is_final?: boolean;
          start?: number;
          duration?: number;
          channel?: number;
          channel_index?: number[];
        };
        if (msg.type === 'Transcript' && msg.is_final === true) {
          clearTimeout(t);
          expect(msg.transcript).toBe('Hello world');
          expect(msg.start).toBe(1.5);
          expect(msg.duration).toBe(2.25);
          expect(msg.channel).toBe(1);
          expect(msg.channel_index).toEqual([1]);
          finish();
        }
      } catch (e) {
        finish(e as Error);
      }
    });
    client.on('close', () => {
      if (!finished) {
        clearTimeout(t);
        finish(new Error('Issue #496: connection closed before receiving Transcript'));
      }
    });
    client.on('error', (err) => finish(err));
  }, 6000);

  /**
   * Issue #499 (Deepgram parity): When upstream sends conversation.item.added with assistant item whose content is only
   * a function_call part, client must receive ConversationText (assistant) with content like "Function call: name(args)".
   */
  itMockOnly('Issue #499: conversation.item.added with only function_call part → ConversationText (assistant) for parity', (done) => {
    mockSendConversationItemAddedFunctionCallOnly = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    const t = setTimeout(() => {
      finish(new Error('Issue #499: timeout, did not receive ConversationText (assistant) for function_call-only item'));
    }, 5000);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string };
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          const content = msg.content ?? '';
          if (content.includes('Function call') && content.includes('get_current_time')) {
            clearTimeout(t);
            finish();
          }
        }
      } catch {
        // ignore
      }
    });
    client.on('close', () => {
      if (!finished) {
        clearTimeout(t);
        finish(new Error('Issue #499: connection closed before receiving ConversationText'));
      }
    });
    client.on('error', (err) => finish(err));
  }, 6000);

  /**
   * Upstream requirement: use conversation.item for finalized message and conversation history; response.output_text.done is control only.
   * When upstream sends ONLY response.output_text.done (no conversation.item.added/.done for assistant), client must NOT receive ConversationText (assistant).
   * Also: no FunctionCallRequest. Asserts SettingsApplied, AgentAudioDone/AgentDone, and no FCR and no ConversationText (assistant).
   */
  itMockOnly('Upstream requirement: when upstream sends only output_text.done (no item), client does not receive ConversationText (assistant)', (done) => {
    mockSendOutputTextOnlyAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; content?: string; role?: string }> = [];
    let finished = false;
    let lastError: Error | undefined;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      lastError = err;
      try { client.close(); } catch { /* ignore */ }
    };
    const debug = process.env.DEBUG_OPENAI_PROXY_INTEGRATION === '1';
    const t = setTimeout(() => {
      const hasFCR = received.some((m) => m.type === 'FunctionCallRequest');
      const hasConvTextAssistant = received.some((m) => m.type === 'ConversationText' && m.role === 'assistant');
      const hasDone = received.some((m) => m.type === 'AgentAudioDone' || m.type === 'AgentDone');
      if (hasConvTextAssistant) {
        finish(new Error('Upstream requirement: must not send ConversationText (assistant) from response.output_text.done when no conversation.item event; received: ' + JSON.stringify(received.filter((m) => m.type === 'ConversationText'))));
        return;
      }
      if (received.some((m) => m.type === 'SettingsApplied') && !hasFCR && hasDone) finish();
      else finish(new Error(`timeout: FCR=${hasFCR} convTextAssistant=${hasConvTextAssistant} done=${hasDone}, received: ${received.map((m) => m.type + (m.role ? `(${m.role})` : '')).join(', ')}`));
    }, 4000);
    client.on('close', () => {
      if (finished) {
        if (lastError) done(lastError);
        else done();
      }
    });
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
      if (debug) process.stdout.write('[client] open, sent Settings (outputTextOnly test)\n');
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string; role?: string };
      if (msg.type) {
        received.push({ type: msg.type, content: msg.content, role: msg.role });
        if (debug) process.stdout.write(`[client] received: ${msg.type}${msg.role ? ` role=${msg.role}` : ''}${msg.content ? ` content=${String(msg.content).slice(0, 50)}...` : ''}\n`);
      }
      if (received.some((m) => m.type === 'FunctionCallRequest')) {
        clearTimeout(t);
        finish(new Error('expected no FunctionCallRequest'));
        return;
      }
      if (received.some((m) => m.type === 'ConversationText' && m.role === 'assistant')) {
        clearTimeout(t);
        finish(new Error('Upstream requirement: must not send ConversationText (assistant) from response.output_text.done only'));
        return;
      }
      if (received.some((m) => m.type === 'SettingsApplied') && received.some((m) => m.type === 'AgentAudioDone' || m.type === 'AgentDone')) {
        clearTimeout(t);
        finish();
      }
    });
    client.on('error', (err) => finish(err));
  }, 5000);

  /**
   * When upstream sends output_audio_transcript.done then response.function_call_arguments.done,
   * proxy sends AgentStartedSpeaking then FunctionCallRequest (Issue #489 Phase 2: no ConversationText from these control events).
   * This test asserts client receives SettingsApplied, then AgentStartedSpeaking, then FunctionCallRequest in order.
   */
  itMockOnly('sends AgentStartedSpeaking then FunctionCallRequest when upstream sends transcript.done then function_call_arguments.done', (done) => {
    mockSendTranscriptThenFunctionCallAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const receivedOrder: Array<{ type: string; content?: string }> = [];
    let finished = false;
    let lastError: Error | undefined;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      lastError = err;
      try { client.close(); } catch { /* ignore */ }
    };
    const debug = process.env.DEBUG_OPENAI_PROXY_INTEGRATION === '1';
    const t = setTimeout(() => finish(new Error('timeout: expected SettingsApplied, AgentStartedSpeaking, FunctionCallRequest')), 4000);
    client.on('close', () => {
      if (finished) {
        if (lastError) done(lastError);
        else done();
      }
    });
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
      if (debug) process.stdout.write('[client] open, sent Settings (transcriptThenFCR test)\n');
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
      if (msg.type) {
        receivedOrder.push({ type: msg.type, content: msg.content });
        if (debug) process.stdout.write(`[client] received: ${msg.type}${msg.content ? ` content=${String(msg.content).slice(0, 50)}...` : ''}\n`);
      }
      const settingsIdx = receivedOrder.findIndex((m) => m.type === 'SettingsApplied');
      const assIdx = receivedOrder.findIndex((m) => m.type === 'AgentStartedSpeaking');
      const fcrIdx = receivedOrder.findIndex((m) => m.type === 'FunctionCallRequest');
      if (settingsIdx >= 0 && assIdx >= 0 && fcrIdx >= 0 && settingsIdx < assIdx && assIdx < fcrIdx) {
        clearTimeout(t);
        finish();
      }
    });
    client.on('error', (err) => finish(err));
  }, 5000);

  it('echoes user message as ConversationText (role user) when client sends InjectUserMessage', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    const userContent = 'My favorite color is blue';
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string; description?: string };
        if (msg.type === 'Error') {
          finish(new Error(`Upstream error (regression): ${msg.description ?? 'unknown'}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: userContent }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'user') {
          expect(msg.content).toBe(userContent);
          if (useRealAPIs) {
            // Wait 5s so late-arriving upstream Error fails the test
            setTimeout(() => finish(), 5000);
          } else {
            finish();
          }
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => finish(err));
  }, useRealAPIs ? 25000 : 5000);

  /**
   * Issue #388 (TDD red): Proxy must send response.create only AFTER receiving conversation.item.added
   * from upstream for the user message. OpenAI Realtime API expects "after adding the user message"
   * before response.create. Current proxy sends both immediately; this test fails until the proxy waits.
   */
  itMockOnly('Issue #388: sends response.create only after receiving conversation.item.added from upstream for InjectUserMessage', (done) => {
    mockDelayItemAddedForInjectUserMessageMs = 100;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
      if (msg.type === 'SettingsApplied') {
        mockReceived.length = 0;
        client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is 2 plus 2?' }));
      }
      if (msg.type === 'ConversationText' && msg.role === 'assistant') {
        try {
          const lastItemCreateIndex = mockReceived.map((m) => m.type).lastIndexOf('conversation.item.create');
          const responseCreateIndex = mockReceived.findIndex((m) => m.type === 'response.create');
          expect(lastItemCreateIndex).toBeGreaterThanOrEqual(0);
          expect(responseCreateIndex).toBeGreaterThanOrEqual(0);
          expect(responseCreateIndex).toBeGreaterThan(lastItemCreateIndex);
          const itemCreate = mockReceived[lastItemCreateIndex];
          const responseCreate = mockReceived[responseCreateIndex];
          const delayMs = (responseCreate.at ?? 0) - (itemCreate.at ?? 0);
          expect(delayMs).toBeGreaterThanOrEqual(50);
        } finally {
          mockDelayItemAddedForInjectUserMessageMs = 0;
          client.close();
          done();
        }
      }
    });
    client.on('error', done);
  }, 5000);

  /**
   * Issue #489: Prior-session context is sent in session.update instructions only (not as conversation.item.create).
   * Proxy must send session.update with instructions containing "Previous conversation:" and the context messages.
   * No conversation.item.create for context (avoids API echo and duplicate messages in UI).
   */
  itMockOnly('sends Settings.agent.context in session.update instructions (no conversation.item.create for context)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    receivedSessionUpdatePayloads.length = 0;
    protocolErrors.length = 0;
    mockEnforceSessionBeforeContext = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: {
          think: { prompt: 'Help.' },
          context: {
            messages: [
              { type: 'History', role: 'user', content: 'Hello' },
              { type: 'History', role: 'assistant', content: 'Hi there!' },
            ],
          },
        },
      }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        expect(protocolErrors).toHaveLength(0);
        mockEnforceSessionBeforeContext = false;
        expect(mockReceived.map((m) => m.type)).toContain('session.update');
        expect(receivedSessionUpdatePayloads.length).toBeGreaterThanOrEqual(1);
        const sessionUpdate = receivedSessionUpdatePayloads[0];
        const instructions = typeof sessionUpdate?.session?.instructions === 'string' ? sessionUpdate.session.instructions : '';
        expect(instructions).toContain('Previous conversation:');
        expect(instructions).toContain('user: Hello');
        expect(instructions).toContain('assistant: Hi there!');
        const itemCreates = receivedConversationItems.filter((m) => m.type === 'conversation.item.create');
        expect(itemCreates.length).toBe(0);
        client.close();
        done();
      }
    });
    client.on('error', (err) => {
      mockEnforceSessionBeforeContext = false;
      done(err);
    });
  }, 8000);

  /**
   * Issue #480: Real-API test for context. Only runs with USE_REAL_APIS=1 and OPENAI_API_KEY.
   * Sends Settings with agent.context.messages (user + assistant), then InjectUserMessage with
   * a follow-up that only makes sense with context. Asserts the model's response is contextualized
   * (includes "blue"). When the real API ignores context, this test fails (RED). Fix proxy so
   * context is available to the model (GREEN).
   */
  (useRealAPIs ? it : it.skip)('Issue #480 real-API: Settings with context.messages + follow-up yields contextualized response (USE_REAL_APIS=1)', (done) => {
    let finished = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const errorsReceived: string[] = [];
    let assistantContent: string | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };

    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: {
          think: { prompt: 'You are a helpful assistant. Answer briefly.' },
          context: {
            messages: [
              { type: 'History', role: 'user', content: 'Remember my favorite color is blue.' },
              { type: 'History', role: 'assistant', content: "I'll remember that your favorite color is blue." },
            ],
          },
        },
      }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; description?: string; role?: string; content?: string };
        if (msg.type === 'Error' && msg.description) {
          errorsReceived.push(msg.description);
          finish(new Error(`Issue #480 real-API: upstream error: ${msg.description}`));
          return;
        }
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'What is my favorite color?' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant' && typeof msg.content === 'string') {
          assistantContent = msg.content;
          if (errorsReceived.length > 0) {
            finish(new Error(`Issue #480 real-API: received errors before assistant response: ${errorsReceived.join('; ')}`));
            return;
          }
          expect(assistantContent.length).toBeGreaterThan(0);
          expect(assistantContent.toLowerCase()).toContain('blue');
          setTimeout(() => finish(), 500);
        }
      } catch (e) {
        finish(e as Error);
      }
    });
    client.on('error', (err) => finish(err));
    timeoutId = setTimeout(() => {
      if (!finished) {
        finish(new Error(
          `Issue #480 real-API: timeout. Context may be ignored by model. ` +
          `assistantContent=${assistantContent ?? 'null'}, errors=${errorsReceived.length}`
        ));
      }
    }, 25000);
  }, 30000);

  /**
   * Greeting (Issue #381): When Settings includes agent.greeting, after session.updated the proxy
   * sends SettingsApplied, then injects the greeting as ConversationText (assistant) to the client
   * and as conversation.item.create (assistant) to upstream.
   * Note: This test does NOT assert greeting audio (binary PCM). It only asserts greeting as text.
   * Greeting audio is validated by E2E "connect only" test (greeting-playback-validation.spec.js).
   */
  itMockOnly('injects agent.greeting as ConversationText to client only (not sent to upstream)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    protocolErrors.length = 0;
    const greeting = 'Hello! How can I help you today?';
    let receivedGreetingText = false;
    let receivedSettingsApplied = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Hi' }, greeting },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string };
        if (msg.type === 'SettingsApplied') receivedSettingsApplied = true;
        if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content === greeting) {
          receivedGreetingText = true;
        }
      } catch {
        // ignore
      }
    });
    // Wait long enough for any upstream send to have happened
    timeoutId = setTimeout(() => {
      client.close();
      try {
        expect(receivedSettingsApplied).toBe(true);
        expect(receivedGreetingText).toBe(true);
        // Greeting must NOT be sent to upstream as conversation.item.create — OpenAI Realtime
        // rejects client-created assistant messages ("The server had an error").
        const assistantItem = receivedConversationItems.find(
          (m) => m.item?.type === 'message' && m.item?.role === 'assistant'
        );
        expect(assistantItem).toBeUndefined();
        expect(protocolErrors).toHaveLength(0);
        done();
      } catch (err) {
        done(err);
      }
    }, 1500);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
  });

  /**
   * Issue #489 TDD (E2E greeting idle timeout): After the proxy sends greeting as ConversationText,
   * it must send AgentAudioDone so the component can transition to idle and the idle timeout can start.
   * Without this, E2E "timeout after greeting" tests fail in proxy mode.
   */
  itMockOnly('Issue #489 TDD: client receives AgentAudioDone after greeting ConversationText (idle timeout can start)', (done) => {
    mockReceived.length = 0;
    protocolErrors.length = 0;
    const greeting = 'Hello! How can I help you today?';
    const clientMessages: Array<{ type?: string; role?: string; content?: string }> = [];
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Hi' }, greeting },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string };
        if (msg.type) clientMessages.push(msg);
      } catch {
        // ignore
      }
    });
    timeoutId = setTimeout(() => {
      client.close();
      try {
        const greetingMsg = clientMessages.find((m) => m.type === 'ConversationText' && m.role === 'assistant' && m.content === greeting);
        expect(greetingMsg).toBeDefined();
        const agentAudioDoneAfterGreeting = clientMessages.some((m) => m.type === 'AgentAudioDone');
        expect(agentAudioDoneAfterGreeting).toBe(true);
        expect(protocolErrors).toHaveLength(0);
        done();
      } catch (err) {
        done(err);
      }
    }, 2000);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
  });

  /**
   * Issue #414: session.created must NOT trigger SettingsApplied or context/greeting injection.
   * OpenAI sends session.created immediately on WebSocket open, BEFORE our session.update is
   * processed. If the proxy injects context/greeting on session.created, the upstream receives
   * conversation.item.create for an unconfigured session → error.
   *
   * This test has the mock send session.created on connection open. The proxy must:
   * 1. NOT send SettingsApplied to client on session.created
   * 2. Only send SettingsApplied on session.updated (after session.update is processed)
   * 3. Only inject greeting after session.updated
   */
  itMockOnly('Issue #414: session.created does not trigger SettingsApplied or greeting injection (only session.updated does)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    protocolErrors.length = 0;
    mockSendSessionCreatedOnConnect = true;
    mockSendItemAddedForAssistant = true;
    mockEnforceSessionBeforeContext = true;
    const greeting = 'Hi there!';
    const clientMessages: Array<{ type?: string; role?: string; content?: string }> = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Be helpful.' }, greeting },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string };
        clientMessages.push(msg);
      } catch {
        // binary or unparseable — ignore
      }
    });
    // Wait long enough for both session.created and session.updated to be processed
    setTimeout(() => {
      try {
        // Client should receive exactly ONE SettingsApplied (from session.updated, not session.created)
        const settingsAppliedCount = clientMessages.filter((m) => m.type === 'SettingsApplied').length;
        expect(settingsAppliedCount).toBe(1);
        // Greeting ConversationText should be present (sent after session.updated)
        const greetingMsg = clientMessages.find((m) => m.type === 'ConversationText' && m.role === 'assistant' && m.content === greeting);
        expect(greetingMsg).toBeDefined();
        // No protocol errors (context/greeting must not arrive before session.updated)
        expect(protocolErrors).toHaveLength(0);
        client.close();
        mockSendSessionCreatedOnConnect = false;
        mockSendItemAddedForAssistant = false;
        mockEnforceSessionBeforeContext = false;
        done();
      } catch (err) {
        client.close();
        mockSendSessionCreatedOnConnect = false;
        mockSendItemAddedForAssistant = false;
        mockEnforceSessionBeforeContext = false;
        done(err);
      }
    }, 500);
    client.on('error', (err) => {
      mockSendSessionCreatedOnConnect = false;
      mockSendItemAddedForAssistant = false;
      mockEnforceSessionBeforeContext = false;
      done(err);
    });
  });

  /**
   * Issue #414: greeting must NOT be sent to upstream (no conversation.item.create, no response.create).
   * OpenAI Realtime API rejects client-created assistant messages. Greeting is text-only to client.
   */
  itMockOnly('Issue #414: greeting must not send conversation.item.create or response.create to upstream', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    protocolErrors.length = 0;
    const greeting = 'Welcome!';
    let receivedGreetingText = false;
    let receivedSettingsApplied = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Greet.' }, greeting },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; content?: string; role?: string };
        if (msg.type === 'SettingsApplied') receivedSettingsApplied = true;
        if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content === greeting) {
          receivedGreetingText = true;
        }
      } catch {
        // ignore parse errors for binary frames
      }
    });
    timeoutId = setTimeout(() => {
      client.close();
      try {
        expect(receivedSettingsApplied).toBe(true);
        expect(receivedGreetingText).toBe(true);
        // No conversation.item.create for greeting (assistant items rejected by OpenAI Realtime)
        const assistantItemIdx = receivedConversationItems.findIndex(
          (m) => m.item?.type === 'message' && m.item?.role === 'assistant'
        );
        expect(assistantItemIdx).toBe(-1);
        // No response.create
        const responseCreateIdx = mockReceived.findIndex((m) => m.type === 'response.create');
        expect(responseCreateIdx).toBe(-1);
        expect(protocolErrors).toHaveLength(0);
        done();
      } catch (err) {
        done(err);
      }
    }, 1500);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
  });

  /**
   * Issue #414: greeting is text-only to client — nothing sent to upstream for greeting,
   * regardless of what item events the upstream would send. Greeting never touches upstream.
   */
  itMockOnly('Issue #414 TDD: greeting sends nothing to upstream (text-only to client)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    protocolErrors.length = 0;
    const greeting = 'Hello text-only!';
    let receivedGreetingText = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Greet.' }, greeting },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; content?: string; role?: string };
        if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content === greeting) {
          receivedGreetingText = true;
        }
      } catch {
        // ignore
      }
    });
    timeoutId = setTimeout(() => {
      client.close();
      try {
        expect(receivedGreetingText).toBe(true);
        // Only session.update should have been sent to upstream — no conversation.item.create for greeting
        const itemCreateCount = mockReceived.filter((m) => m.type === 'conversation.item.create').length;
        expect(itemCreateCount).toBe(0);
        const responseCreateCount = mockReceived.filter((m) => m.type === 'response.create').length;
        expect(responseCreateCount).toBe(0);
        done();
      } catch (err) {
        done(err);
      }
    }, 1500);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
  });

  /**
   * Issue #489: With context + greeting, context is in session.update instructions only (no conversation.item.create).
   * When context is present we do not send greeting to client again (they already have it). No response.create.
   */
  itMockOnly('Issue #414 TDD: context + greeting — context in instructions only, no greeting sent when context present (no item creates)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    receivedSessionUpdatePayloads.length = 0;
    protocolErrors.length = 0;
    mockSendItemDoneAfterAdded = true;
    mockEnforceSessionBeforeContext = true;
    const greeting = 'Welcome with context!';
    let receivedGreetingText = false;
    let receivedSettingsApplied = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      mockSendItemDoneAfterAdded = false;
      mockEnforceSessionBeforeContext = false;
    };
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: {
          think: { prompt: 'Help.' },
          greeting,
          context: {
            messages: [
              { type: 'History', role: 'user', content: 'Previous question' },
            ],
          },
        },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; content?: string; role?: string };
        if (msg.type === 'SettingsApplied') receivedSettingsApplied = true;
        if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content === greeting) {
          receivedGreetingText = true;
        }
      } catch {
        // ignore
      }
    });
    timeoutId = setTimeout(() => {
      client.close();
      cleanup();
      try {
        expect(receivedSettingsApplied).toBe(true);
        expect(receivedGreetingText).toBe(false);
        const itemCreateCount = mockReceived.filter((m) => m.type === 'conversation.item.create').length;
        expect(itemCreateCount).toBe(0);
        expect(receivedSessionUpdatePayloads.length).toBeGreaterThanOrEqual(1);
        const instructions = typeof receivedSessionUpdatePayloads[0]?.session?.instructions === 'string'
          ? receivedSessionUpdatePayloads[0].session.instructions : '';
        expect(instructions).toContain('Previous conversation:');
        expect(instructions).toContain('user: Previous question');
        const responseCreateCount = mockReceived.filter((m) => m.type === 'response.create').length;
        expect(responseCreateCount).toBe(0);
        expect(protocolErrors).toHaveLength(0);
        done();
      } catch (err) {
        done(err);
      }
    }, 1500);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanup();
      done(err);
    });
  });

  /**
   * Issue #414 TDD: greeting flow must not produce an upstream error.
   *
   * Root cause (now fixed): proxy used to send conversation.item.create (assistant) and
   * response.create to upstream for the greeting. OpenAI Realtime API rejects client-created
   * assistant messages and errors on response.create after an assistant-only item.
   * Fix: greeting is text-only to client — nothing sent to upstream for greeting.
   *
   * Mock simulates real OpenAI behavior: sends error on response.create when the last
   * conversation.item.create was role=assistant. With the fix, neither is sent for greeting.
   */
  itMockOnly('Issue #414 TDD: greeting flow must not produce upstream error (nothing sent to upstream for greeting)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    protocolErrors.length = 0;
    mockSendSessionCreatedOnConnect = true;
    mockSendItemAddedForAssistant = true;
    mockSendErrorOnAssistantResponseCreate = true;
    const greeting = 'Hello! How can I assist you today?';
    let receivedError: string | null = null;
    let receivedGreetingText = false;
    let receivedSettingsApplied = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      mockSendSessionCreatedOnConnect = false;
      mockSendItemAddedForAssistant = false;
      mockSendErrorOnAssistantResponseCreate = false;
    };
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: {
          think: { prompt: 'You are a helpful voice assistant. Keep your responses concise and informative.' },
          greeting,
        },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string; description?: string };
        if (msg.type === 'SettingsApplied') receivedSettingsApplied = true;
        if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content === greeting) {
          receivedGreetingText = true;
        }
        if (msg.type === 'Error') {
          receivedError = msg.description ?? 'unknown error';
        }
      } catch {
        // binary or unparseable
      }
    });
    // Wait for the full greeting flow to complete (same 5s window as real API error timing)
    timeoutId = setTimeout(() => {
      if (timeoutId) clearTimeout(timeoutId);
      client.close();
      cleanup();
      // Assert: the greeting flow must produce greeting text, SettingsApplied, and NO error
      try {
        expect(receivedSettingsApplied).toBe(true);
        expect(receivedGreetingText).toBe(true);
        expect(receivedError).toBeNull();
        done();
      } catch (err) {
        done(err);
      }
    }, 2000);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanup();
      done(err);
    });
  });

  /**
   * Issue #414: Real-API greeting flow test. Only runs with USE_REAL_APIS=1 and OPENAI_API_KEY.
   * Sends Settings with greeting, asserts: SettingsApplied received, no Error within 10s.
   * This test FAILS against the real API if OpenAI errors during the greeting flow.
   */
  (useRealAPIs ? it : it.skip)('Issue #414 real-API: greeting flow must not produce error (USE_REAL_APIS=1)', (done) => {
    const greeting = 'Hello! How can I assist you today?';
    let receivedError: string | null = null;
    let receivedSettingsApplied = false;
    let receivedGreetingText = false;
    let receivedAudioChunks = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: {
          think: { prompt: 'You are a helpful voice assistant.' },
          greeting,
        },
      }));
    });
    client.on('message', (data: Buffer) => {
      // Check for binary PCM (audio chunks)
      let isJson = false;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string; description?: string };
        if (msg && typeof msg === 'object' && typeof msg.type === 'string') {
          isJson = true;
          if (msg.type === 'SettingsApplied') receivedSettingsApplied = true;
          if (msg.type === 'ConversationText' && msg.role === 'assistant') receivedGreetingText = true;
          if (msg.type === 'Error') {
            receivedError = msg.description ?? 'unknown error';
          }
        }
      } catch {
        // not JSON
      }
      if (!isJson && data.length > 100) {
        receivedAudioChunks++;
      }
    });
    // Wait 10s for the full greeting flow (real API can be slow)
    timeoutId = setTimeout(() => {
      client.close();
      const details = `settingsApplied=${receivedSettingsApplied}, greeting=${receivedGreetingText}, audioChunks=${receivedAudioChunks}, error=${receivedError}`;
      try {
        expect(receivedSettingsApplied).toBe(true);
        if (receivedError) {
          done(new Error(
            `Greeting flow produced a client-visible error: "${receivedError}". ` +
            `This is the Issue #414 manual test failure reproduced in integration. (${details})`
          ));
        } else {
          expect(receivedGreetingText).toBe(true);
          done();
        }
      } catch (err) {
        done(err);
      }
    }, 10000);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
  }, 15000);

  /**
   * Issue #414: session.update uses GA path (session.audio.input). turn_detection comes from
   * Settings.agent.idleTimeoutMs (shared with component); when present and > 0 we send
   * { type: 'server_vad', idle_timeout_ms, create_response: false }. Format: { type: 'audio/pcm', rate: 24000 }.
   */
  itMockOnly('Issue #414: session.update uses GA audio.input (turn_detection from Settings.idleTimeoutMs + format)', (done) => {
    receivedSessionUpdatePayloads.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Help.' } },
      }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string };
        if (msg.type === 'SettingsApplied') {
          expect(receivedSessionUpdatePayloads.length).toBe(1);
          const sessionUpdate = receivedSessionUpdatePayloads[0];
          expect(sessionUpdate.session).toBeDefined();
          const sess = sessionUpdate.session as { audio?: { input?: { turn_detection?: unknown; format?: { type?: string; rate?: number } } }; turn_detection?: unknown };
          const td = sess.audio?.input?.turn_detection;
          expect(td === null || (typeof td === 'object' && td !== null && (td as { type?: string; create_response?: boolean }).type === 'server_vad' && (td as { create_response?: boolean }).create_response === false)).toBe(true);
          expect(sess.audio?.input?.format?.type).toBe('audio/pcm');
          expect(sess.audio?.input?.format?.rate).toBe(24000);
          expect(sess.turn_detection).toBeUndefined();
          client.close();
          done();
        }
      } catch (err) {
        client.close();
        done(err);
      }
    });
    client.on('error', done);
  });

  itMockOnly('Issue #414 TDD: greeting delivers text to client only (nothing to upstream)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    protocolErrors.length = 0;
    const greeting = 'Text greeting!';
    let receivedGreetingText = false;
    let receivedSettingsApplied = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Greet.' }, greeting },
      }));
    });
    client.on('message', (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString()) as { type?: string; content?: string; role?: string };
        if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
          if (parsed.type === 'SettingsApplied') receivedSettingsApplied = true;
          if (parsed.type === 'ConversationText' && parsed.role === 'assistant' && parsed.content === greeting) {
            receivedGreetingText = true;
          }
        }
      } catch {
        // not JSON
      }
    });
    timeoutId = setTimeout(() => {
      client.close();
      try {
        expect(receivedSettingsApplied).toBe(true);
        expect(receivedGreetingText).toBe(true);
        // No conversation.item.create for greeting sent to upstream
        const itemCreateCount = mockReceived.filter((m) => m.type === 'conversation.item.create').length;
        expect(itemCreateCount).toBe(0);
        // No response.create
        const responseCreateCount = mockReceived.filter((m) => m.type === 'response.create').length;
        expect(responseCreateCount).toBe(0);
        done();
      } catch (err) {
        done(err);
      }
    }, 1500);
    client.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      done(err);
    });
  });

  // --- Protocol document test gaps (PROTOCOL-TEST-GAPS.md) ---

  /**
   * Protocol §1.2 / §5: response.output_audio.done must not send any message to client.
   * Mock sends delta → done → output_text.done; client must get exactly one binary frame and one ConversationText; no message for .done.
   */
  itMockOnly('Protocol: response.output_audio.done sends no message to client', (done) => {
    mockSendOutputAudioBeforeText = true;
    let binaryCount = 0;
    const textTypes: string[] = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const str = data.toString('utf8');
      if (data.length > 0 && data[0] === 0x7b) {
        try {
          const msg = JSON.parse(str) as { type?: string; role?: string };
          if (msg.type) textTypes.push(msg.type);
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say hi' }));
          }
          if (msg.type === 'ConversationText' && msg.role === 'assistant') {
            expect(binaryCount).toBe(1);
            expect(textTypes).not.toContain('response.output_audio.done');
            client.close();
            done();
          }
        } catch {
          // ignore
        }
      } else {
        binaryCount++;
      }
    });
    client.on('error', done);
  }, 8000);

  /**
   * Protocol §2.1: Client messages queued until upstream open, then drained in order.
   * Client sends Settings then InjectUserMessage immediately; assert upstream receives session.update then conversation.item.create.
   */
  itMockOnly('Protocol: client message queue order (session.update then conversation.item.create)', (done) => {
    mockReceived.length = 0;
    mockEnforceSessionBeforeContext = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
      client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Hello' }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          const types = mockReceived.map((m) => m.type);
          const sessionUpdateIdx = types.indexOf('session.update');
          const itemCreateIdx = types.indexOf('conversation.item.create');
          expect(sessionUpdateIdx).toBeGreaterThanOrEqual(0);
          expect(itemCreateIdx).toBeGreaterThanOrEqual(0);
          expect(sessionUpdateIdx).toBeLessThan(itemCreateIdx);
          mockEnforceSessionBeforeContext = false;
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => {
      mockEnforceSessionBeforeContext = false;
      done(err);
    });
  }, 8000);

  /**
   * Protocol §4: Same item id — .added and .done must decrement counter once (proxy sends exactly one response.create).
   */
  itMockOnly('Protocol: same item id .added + .done count once (one response.create)', (done) => {
    mockReceived.length = 0;
    mockSendItemDoneAfterAdded = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Hi' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          const responseCreateCount = mockReceived.filter((m) => m.type === 'response.create').length;
          expect(responseCreateCount).toBe(1);
          mockSendItemDoneAfterAdded = false;
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => {
      mockSendItemDoneAfterAdded = false;
      done(err);
    });
  }, 8000);

  /**
   * Protocol §3: Other client JSON (unknown type) forwarded to upstream as-is.
   */
  itMockOnly('Protocol: other client JSON (e.g. KeepAlive) forwarded to upstream', (done) => {
    mockReceived.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type === 'SettingsApplied') {
          client.send(JSON.stringify({ type: 'KeepAlive' }));
          client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Hi' }));
        }
        if (msg.type === 'ConversationText' && msg.role === 'assistant') {
          const hasKeepAlive = mockReceived.some((m) => m.type === 'KeepAlive');
          expect(hasKeepAlive).toBe(true);
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', done);
  }, 8000);

  /**
   * Unmapped upstream events: proxy sends Error (unmapped_upstream_event), does not forward as text.
   * Mock sends conversation.created (unmapped) after session.updated; client must receive Error with code unmapped_upstream_event.
   */
  itMockOnly('Protocol: unmapped upstream event (e.g. conversation.created) yields Error (unmapped_upstream_event)', (done) => {
    mockSendUnmappedEventAfterSessionUpdated = true;
    let finished = false;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const clearFallback = scheduleFallbackTimeout(5000, () => {
      if (finished) return;
      finished = true;
      client.close();
      done(new Error('Expected to receive Error (unmapped_upstream_event) from proxy within 5s'));
    });
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; code?: string; description?: string };
        if (msg?.type === 'Error' && msg.code === 'unmapped_upstream_event') {
          expect(msg.description).toContain('conversation.created');
          finished = true;
          clearFallback();
          client.close();
          done();
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => {
      if (!finished) done(err);
    });
  }, 8000);

  /**
   * Issue #500: Proxy must not forward raw conversation.item.created/.added/.done to client; only mapped ConversationText (and control) are sent.
   */
  itMockOnly('Issue #500: client does not receive raw conversation.item.added/created/done (only mapped ConversationText)', (done) => {
    mockSendOutputAudioBeforeText = true;
    const receivedTextTypes: string[] = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length > 0 && data[0] === 0x7b) {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
          if (msg.type) receivedTextTypes.push(msg.type);
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say hi' }));
          }
          if (msg.type === 'ConversationText' && msg.role === 'assistant') {
            const hasRawItemEvent = receivedTextTypes.some(
              (t) => t === 'conversation.item.added' || t === 'conversation.item.done' || t === 'conversation.item.created'
            );
            expect(hasRawItemEvent).toBe(false);
            client.close();
            done();
          }
        } catch {
          // ignore
        }
      }
    });
    client.on('error', done);
  }, 8000);

  /**
   * Issue #482 TDD (CAUSE-INVESTIGATION): Proxy must send AgentStartedSpeaking so the component sees "agent active"
   * and does not fire client idle timeout. Client must receive AgentStartedSpeaking before ConversationText
   * (assistant) for the same turn.
   */
  itMockOnly('Issue #482 TDD: client receives AgentStartedSpeaking before ConversationText (assistant) for same turn', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; role?: string }> = [];
    let finished = false;
    const clearFallback = scheduleFallbackTimeout(5000, () => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      const startedIdx = received.findIndex((m) => m.type === 'AgentStartedSpeaking');
      const ctIdx = received.findIndex((m) => m.type === 'ConversationText' && m.role === 'assistant');
      try {
        expect(received.some((m) => m.type === 'AgentStartedSpeaking')).toBe(true);
        expect(received.some((m) => m.type === 'ConversationText' && m.role === 'assistant')).toBe(true);
        expect(startedIdx).toBeLessThan(ctIdx);
      } catch (e) {
        done(e as Error);
        return;
      }
      done();
    });
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      clearFallback();
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type) {
          received.push({ type: msg.type, role: msg.role });
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say hi' }));
          }
          const startedIdx = received.findIndex((m) => m.type === 'AgentStartedSpeaking');
          const ctIdx = received.findIndex((m) => m.type === 'ConversationText' && m.role === 'assistant');
          if (startedIdx >= 0 && ctIdx >= 0) {
            expect(startedIdx).toBeLessThan(ctIdx);
            finish();
          }
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => finish(err));
  }, 8000);

  /**
   * Issue #482 TDD (CAUSE-INVESTIGATION): Proxy must send AgentAudioDone when response completes so the
   * component can treat agent output as complete (idle timeout sees "agent produced output").
   */
  itMockOnly('Issue #482 TDD: client receives AgentAudioDone when response completes (output_text.done)', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; role?: string }> = [];
    let finished = false;
    const clearFallback = scheduleFallbackTimeout(5000, () => {
      if (finished) return;
      finished = true;
      try { client.close(); } catch { /* ignore */ }
      try {
        expect(received.some((m) => m.type === 'ConversationText' && m.role === 'assistant')).toBe(true);
        expect(received.some((m) => m.type === 'AgentAudioDone')).toBe(true);
      } catch (e) {
        done(e as Error);
        return;
      }
      done();
    });
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      clearFallback();
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type) {
          received.push({ type: msg.type, role: msg.role });
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say hi' }));
          }
          const hasCT = received.some((m) => m.type === 'ConversationText' && m.role === 'assistant');
          const hasDone = received.some((m) => m.type === 'AgentAudioDone');
          if (hasCT && hasDone) {
            finish();
          }
        }
      } catch (e) {
        finish(e as Error);
      }
    });
    client.on('error', (err) => finish(err));
  }, 8000);

  /**
   * Issue #482 (voice-commerce #956): When upstream sends error (idle_timeout), the client must receive
   * ConversationText (assistant) before Error so the UI can show the assistant bubble before the connection
   * closes. Runs only when USE_REAL_APIS=1 and the real API is known to send server idle_timeout in this scenario.
   * Mock: the same assertion is covered by itMockOnly('Issue #482: client receives ConversationText (assistant) before Error (idle_timeout) when upstream sends error before output_text.done').
   *
   * Skip when: (1) mock mode (upstream does not send idle_timeout), or (2) real API has no server timeout
   * (NO_SERVER_TIMEOUT_MS, e.g. OpenAI with turn_detection: null). Otherwise the test would wait 65s and fail
   * with errIdx === -1 because the client never receives Error (idle_timeout).
   */
  const realAPIServerTimeoutMs = NO_SERVER_TIMEOUT_MS; // OpenAI with turn_detection: null has no server timeout
  (useRealAPIs && realAPIServerTimeoutMs !== NO_SERVER_TIMEOUT_MS ? it : it.skip)('Issue #482 real-API: client receives ConversationText (assistant) before Error (idle_timeout) (USE_REAL_APIS=1)', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; role?: string; code?: string }> = [];
    let finished = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    // Include idleTimeoutMs so proxy can send it when API supports it; server may still use its default when turn_detection is null.
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Say hi briefly.' }, idleTimeoutMs: 15000 },
      }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; code?: string };
        if (msg.type) {
          received.push({ type: msg.type, role: msg.role, code: msg.code });
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Hi' }));
          }
          const errIdx = received.findIndex((m) => m.type === 'Error' && m.code === SERVER_TIMEOUT_ERROR_CODE);
          if (errIdx >= 0) {
            const ctIdx = received.findIndex((m) => m.type === 'ConversationText' && m.role === 'assistant');
            try {
              expect(received.some((m) => m.type === 'ConversationText' && m.role === 'assistant')).toBe(true);
              expect(ctIdx).toBeLessThan(errIdx);
            } catch (e) {
              finish(e as Error);
              return;
            }
            finish();
          }
        }
      } catch {
        // ignore
      }
    });
    const serverTimeoutDeadlineMs = DEFAULT_SERVER_TIMEOUT_MS + 5000;
    timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      // Defer assert + done to next tick so this callback returns and the timer handle is released (avoids open handle in --detectOpenHandles).
      setImmediate(() => {
        const ctIdx = received.findIndex((m) => m.type === 'ConversationText' && m.role === 'assistant');
        const errIdx = received.findIndex((m) => m.type === 'Error' && m.code === SERVER_TIMEOUT_ERROR_CODE);
        try {
          expect(errIdx).toBeGreaterThanOrEqual(0);
          expect(ctIdx).toBeGreaterThanOrEqual(0);
          expect(ctIdx).toBeLessThan(errIdx);
        } catch (e) {
          done(e as Error);
          return;
        }
        done();
      });
    }, serverTimeoutDeadlineMs);
    client.on('error', (err) => finish(err));
  }, DEFAULT_SERVER_TIMEOUT_MS + 10000);

  /**
   * Issue #489 PROTOCOL-ASSURANCE-GAPS: With real API, for a turn (InjectUserMessage → response), client receives
   * AgentStartedSpeaking before ConversationText (assistant). Asserts message order for a single turn.
   * USE_REAL_APIS=1.
   */
  (useRealAPIs ? it : it.skip)('Issue #489 real-API: client receives AgentStartedSpeaking before ConversationText (assistant) for a turn', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const receivedOrder: Array<{ type: string; role?: string }> = [];
    let finished = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Reply in one short sentence.' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (!looksLikeJsonObject(data)) return; // Do not parse binary (PCM); PROTOCOL-SPECIFICATION §5
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string };
        if (msg.type) {
          receivedOrder.push({ type: msg.type, role: msg.role });
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say hello.' }));
          }
          if (msg.type === 'ConversationText' && msg.role === 'assistant') {
            const idxAgentStartedSpeaking = receivedOrder.findIndex((m) => m.type === 'AgentStartedSpeaking');
            const idxConversationText = receivedOrder.findIndex((m) => m.type === 'ConversationText' && m.role === 'assistant');
            if (idxAgentStartedSpeaking >= 0 && idxConversationText >= 0 && idxAgentStartedSpeaking < idxConversationText) {
              finish();
            } else if (idxConversationText >= 0) {
              finish(new Error(
                `Issue #489: AgentStartedSpeaking not before ConversationText (assistant). ` +
                `Order: ${receivedOrder.map((m) => m.type + (m.role ? `(${m.role})` : '')).join(', ')}`,
              ));
            }
          }
        }
      } catch (e) {
        // Parse errors must surface so we can correct them; never skip (PROTOCOL-SPECIFICATION §5)
        finish(e as Error);
      }
    });
    client.on('error', (err) => finish(err));
    timeoutId = setTimeout(() => {
      if (!finished) {
        const hasCT = receivedOrder.some((m) => m.type === 'ConversationText' && m.role === 'assistant');
        const hasASS = receivedOrder.some((m) => m.type === 'AgentStartedSpeaking');
        finish(new Error(
          `Issue #489: timeout; got ConversationText(assistant)=${hasCT} AgentStartedSpeaking=${hasASS}; ` +
          `order: ${receivedOrder.map((m) => m.type + (m.role ? `(${m.role})` : '')).join(', ')}`,
        ));
      }
    }, 25000);
  }, 30000);

  /**
   * Issue #482 mock: same assertion as real-API test. Mock sends error (idle_timeout) then response.output_text.done
   * so proxy currently forwards Error first; test fails until proxy sends ConversationText before Error.
   */
  itMockOnly('Issue #482: client receives ConversationText (assistant) before Error (idle_timeout) when upstream sends error before output_text.done', (done) => {
    mockSendIdleTimeoutBeforeOutputTextDone = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; role?: string; code?: string }> = [];
    let finished = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      if (err) done(err);
      else done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; role?: string; code?: string };
        if (msg.type) {
          received.push({ type: msg.type, role: msg.role, code: msg.code });
          if (msg.type === 'SettingsApplied') {
            client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'Say hi' }));
          }
          const ctIdx = received.findIndex((m) => m.type === 'ConversationText' && m.role === 'assistant');
          const errIdx = received.findIndex((m) => m.type === 'Error' && m.code === 'idle_timeout');
          if (ctIdx >= 0 && errIdx >= 0) {
            expect(ctIdx).toBeLessThan(errIdx);
            finish();
          }
        }
      } catch {
        // ignore
      }
    });
    timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try { client.close(); } catch { /* ignore */ }
      setImmediate(() => {
        const ctIdx = received.findIndex((m) => m.type === 'ConversationText' && m.role === 'assistant');
        const errIdx = received.findIndex((m) => m.type === 'Error' && m.code === 'idle_timeout');
        try {
          expect(received.some((m) => m.type === 'ConversationText' && m.role === 'assistant')).toBe(true);
          expect(received.some((m) => m.type === 'Error' && m.code === 'idle_timeout')).toBe(true);
          expect(ctIdx).toBeLessThan(errIdx);
        } catch (e) {
          done(e as Error);
          return;
        }
        done();
      });
    }, 5000);
    client.on('error', (err) => finish(err));
  }, 8000);

  /**
   * Issue #470: When upstream sends response.done (and no response.output_text.done) after function_call_output,
   * proxy must send response.create once so the next turn can start. Tests the response.done fallback path.
   * Placed last among mock-only tests to avoid affecting tests that expect output_text.done ("Hello from mock").
   */
  itMockOnly('Issue #470: after function_call_output, response.done (no output_text.done) triggers proxy to send response.create once', (done) => {
    mockReceived.length = 0;
    mockSendFunctionCallAfterSession = true;
    mockSendResponseDoneOnlyAfterFunctionCallOutput = true;
    let finished = false;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const finish = () => {
      if (finished) return;
      finished = true;
      const responseCreateCount = mockReceived.filter((m) => m.type === 'response.create').length;
      expect(responseCreateCount).toBe(1);
      client.close();
      done();
    };
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (finished) return;
      const msg = JSON.parse(data.toString()) as { type?: string; functions?: Array<{ id: string; name: string }> };
      if (msg.type === 'FunctionCallRequest' && msg.functions?.length) {
        client.send(JSON.stringify({
          type: 'FunctionCallResponse',
          id: msg.functions[0].id,
          name: msg.functions[0].name,
          content: '{"time":"12:00"}',
        }));
        const deadline = Date.now() + 2000;
        const check = () => {
          if (finished) return;
          const responseCreateCount = mockReceived.filter((m) => m.type === 'response.create').length;
          if (responseCreateCount >= 1) {
            finish();
            return;
          }
          if (Date.now() < deadline) setTimeout(check, 50);
          else {
            finished = true;
            done(new Error(`Expected mock to receive response.create within 2s; got ${responseCreateCount}`));
          }
        };
        setTimeout(check, 200);
      }
    });
    client.on('error', (err) => { if (!finished) { finished = true; done(err); } });
  }, 8000);
});
