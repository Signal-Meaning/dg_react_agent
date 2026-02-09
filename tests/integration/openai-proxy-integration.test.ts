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
 * Real upstream: set USE_REAL_OPENAI=1 and OPENAI_API_KEY to run a subset of tests
 * against the live OpenAI Realtime API. See docs/development/TEST-STRATEGY.md.
 *
 * Run order: integration tests first against real APIs (when keys available), then mocks.
 * CI runs mocks only.
 *
 * @jest-environment node
 */

import path from 'path';
// Load root .env and test-app/.env so OPENAI_API_KEY is available when running with USE_REAL_OPENAI=1
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'test-app', '.env') });

import http from 'http';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws');
// Load WebSocketServer from ws package (Jest resolve may not expose ws/lib/*)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));
import {
  createOpenAIProxyServer,
} from '../../scripts/openai-proxy/server';

/** When true, proxy uses real OpenAI Realtime URL and auth; mock is not started. Requires OPENAI_API_KEY. */
const useRealOpenAI = process.env.USE_REAL_OPENAI === '1' && !!process.env.OPENAI_API_KEY?.trim();

/** Issue #414 RESOLUTION-PLAN: 100ms PCM at 24kHz 16-bit mono (bytes). */
const PCM_100MS_24K_BYTES = 4800;

/** Issue #414: Load speech-like PCM from project fixtures (TTS/recorded speech); 24 kHz for proxy. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AudioFileLoader = require('../utils/audio-file-loader');
/** Use for tests that require the mock upstream (exact payloads, mockReceived, etc.); skipped when USE_REAL_OPENAI=1. */
const itMockOnly = useRealOpenAI ? it.skip : it;

describe('OpenAI proxy integration (Issue #381)', () => {
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
  /** When true, mock sends response.output_audio.delta (base64 PCM) then .done before response.output_text.done (so client receives binary PCM from proxy). */
  let mockSendOutputAudioBeforeText = false;
  /** Issue #414 3.2: when > 0, mock delays sending response completion (output_audio.delta, .done, output_text.done) by this many ms after receiving response.create. */
  let mockDelayResponseDoneMs = 0;
  /**
   * Issue #406: when true, mock delays sending session.updated and asserts that no conversation.item.create
   * is received before session.updated was sent (catches proxy sending context before session.updated).
   */
  let mockEnforceSessionBeforeContext = false;
  /** Protocol test gap: when true, mock sends response.created (untranslated event) after session.updated so client must receive it as text. */
  let mockSendResponseCreatedAfterSessionUpdated = false;
  /** Protocol errors detected by mock (e.g. conversation.item.create before session.updated). Tests assert this is empty. */
  const protocolErrors: Error[] = [];
  /** Records conversation.item.create payloads for assertions */
  const receivedConversationItems: Array<{ type: string; item?: { type?: string; call_id?: string; output?: string; role?: string } }> = [];
  /** Issue #414 TDD: records session.update payloads sent to upstream for assertions (e.g. turn_detection) */
  const receivedSessionUpdatePayloads: Array<{ type: string; session?: { turn_detection?: unknown; [key: string]: unknown } }> = [];

  beforeAll(async () => {
    proxyServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => proxyServer.listen(0, () => resolve()));
    proxyPort = (proxyServer.address() as { port: number }).port;

    if (useRealOpenAI) {
      const apiKey = process.env.OPENAI_API_KEY!.trim();
      const upstreamUrl = process.env.OPENAI_REALTIME_URL ?? 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
      createOpenAIProxyServer({
        server: proxyServer,
        path: PROXY_PATH,
        upstreamUrl,
        upstreamHeaders: { Authorization: `Bearer ${apiKey}` },
      });
      mockPort = 0;
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
            const sendSessionUpdated = () => {
              socket.send(JSON.stringify({ type: 'session.updated', session: { type: 'realtime' } }));
              sessionUpdatedSent = true;
            };
            if (mockEnforceSessionBeforeContext) {
              setTimeout(() => {
                sendSessionUpdated();
                if (mockSendResponseCreatedAfterSessionUpdated) {
                  mockSendResponseCreatedAfterSessionUpdated = false;
                  socket.send(JSON.stringify({ type: 'response.created', response_id: 'r1' }));
                }
              }, 50);
            } else {
              sendSessionUpdated();
              if (mockSendResponseCreatedAfterSessionUpdated) {
                mockSendResponseCreatedAfterSessionUpdated = false;
                socket.send(JSON.stringify({ type: 'response.created', response_id: 'r1' }));
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
            } else if (mockSendFunctionCallAfterSession) {
              mockSendFunctionCallAfterSession = false;
              socket.send(JSON.stringify({
                type: 'response.function_call_arguments.done',
                call_id: 'call_mock_1',
                name: 'get_current_time',
                arguments: '{}',
              }));
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
            const sendResponseDone = () => {
              if (mockSendOutputAudioBeforeText || mockSendAudioDeltaOnGreetingResponseCreate) {
                if (mockSendOutputAudioBeforeText) mockSendOutputAudioBeforeText = false;
                if (mockSendAudioDeltaOnGreetingResponseCreate) mockSendAudioDeltaOnGreetingResponseCreate = false;
                const pcmChunk = Buffer.alloc(320, 0);
                socket.send(JSON.stringify({ type: 'response.output_audio.delta', delta: pcmChunk.toString('base64') }));
                socket.send(JSON.stringify({ type: 'response.output_audio.done' }));
              }
              socket.send(JSON.stringify({ type: 'response.output_text.done', text: 'Hello from mock' }));
            };
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
    createOpenAIProxyServer({
      server: proxyServer,
      path: PROXY_PATH,
      upstreamUrl: `ws://localhost:${mockPort}`,
    });
  });

  afterAll(async () => {
    if (mockWss) mockWss.close();
    if (mockUpstreamServer) await new Promise<void>((resolve) => mockUpstreamServer!.close(() => resolve()));
    if (proxyServer) await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
  }, 10000);

  beforeEach(() => {
    if (useRealOpenAI) jest.useRealTimers();
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
          if (useRealOpenAI) {
            expect(typeof msg.content).toBe('string');
            expect((msg.content ?? '').length).toBeGreaterThan(0);
          } else {
            expect(msg.content).toBe('Hello from mock');
          }
          if (useRealOpenAI) {
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
  }, useRealOpenAI ? 25000 : 5000);

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
  (useRealOpenAI ? it : it.skip)('Issue #414 real-API: firm audio connection — no Error from upstream within 12s after sending audio (USE_REAL_OPENAI=1)', (done) => {
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
  (useRealOpenAI ? it : it.skip)('Issue #414 real-API: firm audio (speech-like audio) — no Error from upstream within 12s (USE_REAL_OPENAI=1)', (done) => {
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
   * When upstream sends response.function_call_arguments.done, proxy sends FunctionCallRequest first then ConversationText
   * (same order as server.ts). Client must receive both so E2E capture can see FunctionCallRequest.
   * Real OpenAI may send response.output_audio_transcript.done with "Function call: ..." before or without
   * response.function_call_arguments.done; this test asserts the proxy sends both when it gets function_call_arguments.done.
   */
  itMockOnly('sends FunctionCallRequest then ConversationText when upstream sends response.function_call_arguments.done (client receives both)', (done) => {
    mockSendFunctionCallAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const receivedOrder: string[] = [];
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; functions?: Array<{ id: string; name: string }>; role?: string; content?: string };
      if (msg.type) receivedOrder.push(msg.type);
      const hasFCR = receivedOrder.includes('FunctionCallRequest');
      const hasCT = receivedOrder.some((_, i) => receivedOrder[i] === 'ConversationText');
      if (hasFCR && hasCT) {
        expect(receivedOrder.indexOf('FunctionCallRequest')).toBeLessThan(receivedOrder.indexOf('ConversationText'));
        client.close();
        done();
      }
    });
    client.on('error', done);
  }, 5000);

  /**
   * API gap: When upstream sends ONLY response.output_audio_transcript.done with "Function call: ..."
   * (no response.function_call_arguments.done), proxy sends only ConversationText.
   * Client does NOT receive FunctionCallRequest — so onFunctionCallRequest is never invoked.
   * This documents E2E behavior when real API sends function-call info only in transcript.
   */
  itMockOnly('sends only ConversationText when upstream sends only output_audio_transcript.done with "Function call: ..." (no FunctionCallRequest)', (done) => {
    mockSendTranscriptOnlyAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; content?: string }> = [];
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
      if (msg.type) received.push({ type: msg.type, content: msg.content });
      if (msg.type === 'ConversationText' && msg.content?.includes('Function call: get_current_datetime')) {
        const hasFCR = received.some((m) => m.type === 'FunctionCallRequest');
        expect(hasFCR).toBe(false);
        expect(msg.content).toBe('Function call: get_current_datetime({ })');
        client.close();
        done();
      }
    });
    client.on('error', done);
  }, 5000);

  /**
   * API gap: When upstream sends ONLY response.output_text.done with "Function call: ..."
   * (no response.function_call_arguments.done), proxy sends only ConversationText.
   * Client does NOT receive FunctionCallRequest.
   */
  itMockOnly('sends only ConversationText when upstream sends only output_text.done with "Function call: ..." (no FunctionCallRequest)', (done) => {
    mockSendOutputTextOnlyAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const received: Array<{ type: string; content?: string }> = [];
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
      if (msg.type) received.push({ type: msg.type, content: msg.content });
      if (msg.type === 'ConversationText' && msg.content?.includes('Function call: get_current_datetime')) {
        const hasFCR = received.some((m) => m.type === 'FunctionCallRequest');
        expect(hasFCR).toBe(false);
        expect(msg.content).toBe('Function call: get_current_datetime({ })');
        client.close();
        done();
      }
    });
    client.on('error', done);
  }, 5000);

  /**
   * When upstream sends output_audio_transcript.done then response.function_call_arguments.done,
   * proxy sends ConversationText (from transcript), then FunctionCallRequest, then ConversationText (from .done).
   * Client receives CT, FCR, CT — so component gets both transcript display and function call handler.
   */
  itMockOnly('sends ConversationText then FunctionCallRequest then ConversationText when upstream sends transcript.done then function_call_arguments.done', (done) => {
    mockSendTranscriptThenFunctionCallAfterSession = true;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    const receivedOrder: Array<{ type: string; content?: string }> = [];
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
      if (msg.type) receivedOrder.push({ type: msg.type, content: msg.content });
      const fcrIndex = receivedOrder.findIndex((m) => m.type === 'FunctionCallRequest');
      const ctIndices = receivedOrder.map((m, i) => (m.type === 'ConversationText' ? i : -1)).filter((i) => i >= 0);
      if (fcrIndex >= 0 && ctIndices.length >= 2) {
        expect(ctIndices[0]).toBeLessThan(fcrIndex);
        expect(fcrIndex).toBeLessThan(ctIndices[1]);
        client.close();
        done();
      }
    });
    client.on('error', done);
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
          if (useRealOpenAI) {
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
  }, useRealOpenAI ? 25000 : 5000);

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
   * Issue #406: Proxy must send conversation.item.create (context) only after receiving session.updated.
   * Mock enforces this by delaying session.updated; if proxy sends context before waiting, protocol error is recorded.
   */
  itMockOnly('sends Settings.agent.context.messages as conversation.item.create to upstream', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
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
        const itemCreates = receivedConversationItems.filter((m) => m.type === 'conversation.item.create');
        expect(itemCreates.length).toBe(2);
        const userItem = itemCreates.find((m) => m.item?.type === 'message' && m.item?.role === 'user');
        const assistantItem = itemCreates.find((m) => m.item?.type === 'message' && m.item?.role === 'assistant');
        expect(userItem).toBeDefined();
        expect(assistantItem).toBeDefined();
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
   * Issue #414: With context messages + greeting, only context items are sent to upstream.
   * Greeting is text-only to client. No conversation.item.create for greeting, no response.create.
   */
  itMockOnly('Issue #414 TDD: context + greeting sends only context items to upstream (greeting is text-only)', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
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
        expect(receivedGreetingText).toBe(true);
        // Only the context item should have been sent to upstream (1 context, 0 greeting)
        const itemCreateCount = mockReceived.filter((m) => m.type === 'conversation.item.create').length;
        expect(itemCreateCount).toBe(1); // 1 context only — greeting is NOT sent to upstream
        // No response.create
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
   * Issue #414: Real-API greeting flow test. Only runs with USE_REAL_OPENAI=1 and OPENAI_API_KEY.
   * Sends Settings with greeting, asserts: SettingsApplied received, no Error within 10s.
   * This test FAILS against the real API if OpenAI errors during the greeting flow.
   */
  (useRealOpenAI ? it : it.skip)('Issue #414 real-API: greeting flow must not produce error (USE_REAL_OPENAI=1)', (done) => {
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
   * Protocol §5: Any other upstream event forwarded to client as text.
   */
  itMockOnly('Protocol: other upstream event (e.g. response.created) forwarded to client as text', (done) => {
    mockSendResponseCreatedAfterSessionUpdated = true;
    let finished = false;
    const clientMessages: Array<{ type?: string }> = [];
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      if (data.length === 0 || data[0] !== 0x7b) return;
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; response_id?: string };
        if (msg && typeof msg === 'object' && typeof msg.type === 'string') {
          clientMessages.push({ type: msg.type });
          if (msg.type === 'response.created') {
            expect(msg.response_id).toBe('r1');
            finished = true;
            client.close();
            done();
          }
        }
      } catch {
        // ignore
      }
    });
    client.on('error', (err) => {
      if (!finished) done(err);
    });
    setTimeout(() => {
      if (finished) return;
      finished = true;
      client.close();
      const hasResponseCreated = clientMessages.some((m) => m.type === 'response.created');
      if (!hasResponseCreated) {
        done(new Error('Expected to receive response.created from proxy (other upstream events must be forwarded as text)'));
      } else {
        done();
      }
    }, 5000);
  }, 8000);

  /**
   * Protocol §1.2 (optional): conversation.item.added / .done received as text (not binary).
   */
  itMockOnly('Protocol: conversation.item.added or .done received by client as text frame', (done) => {
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
            const hasItemEvent = receivedTextTypes.some(
              (t) => t === 'conversation.item.added' || t === 'conversation.item.done' || t === 'conversation.item.created'
            );
            expect(hasItemEvent).toBe(true);
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
});
