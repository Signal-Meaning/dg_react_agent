/**
 * OpenAI proxy integration tests (Issue #381)
 *
 * Proxy as WebSocket server: real WebSocket connections, mock OpenAI upstream.
 * See docs/issues/ISSUE-381/INTEGRATION-TEST-PLAN.md.
 *
 * @jest-environment node
 */

import http from 'http';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws');
// Load WebSocketServer from ws package (Jest resolve may not expose ws/lib/*)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketServer = require(path.join(path.dirname(require.resolve('ws')), 'lib', 'websocket-server.js'));
import {
  createOpenAIProxyServer,
} from '../../scripts/openai-proxy/server';

describe('OpenAI proxy integration (Issue #381)', () => {
  let mockUpstreamServer: http.Server;
  let mockWss: InstanceType<typeof WebSocketServer>;
  let mockPort: number;
  let proxyServer: http.Server;
  let proxyPort: number;
  const PROXY_PATH = '/openai';
  const mockReceived: Array<{ type: string }> = [];
  /** When true, mock sends response.function_call_arguments.done after session.updated (for function-call test) */
  let mockSendFunctionCallAfterSession = false;
  /** When true, mock sends only response.output_audio_transcript.done with "Function call: ..." after session.updated (no .done event) */
  let mockSendTranscriptOnlyAfterSession = false;
  /** When true, mock sends only response.output_text.done with "Function call: ..." after session.updated (no .done event) */
  let mockSendOutputTextOnlyAfterSession = false;
  /** When true, mock sends output_audio_transcript.done then response.function_call_arguments.done after session.updated */
  let mockSendTranscriptThenFunctionCallAfterSession = false;
  /** Records conversation.item.create payloads for assertions */
  const receivedConversationItems: Array<{ type: string; item?: { type?: string; call_id?: string; output?: string; role?: string } }> = [];

  beforeAll(async () => {
    mockUpstreamServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => mockUpstreamServer.listen(0, () => resolve()));
    mockPort = (mockUpstreamServer.address() as { port: number }).port;
    mockWss = new WebSocketServer({ server: mockUpstreamServer });
    mockWss.on('connection', (socket: import('ws')) => {
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string; item?: { type?: string; call_id?: string; output?: string; role?: string } };
          if (msg.type) mockReceived.push({ type: msg.type });
          if (msg.type === 'conversation.item.create') {
            receivedConversationItems.push({ type: msg.type, item: msg.item });
          }
          if (msg.type === 'session.update') {
            socket.send(JSON.stringify({ type: 'session.updated', session: { type: 'realtime' } }));
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
            socket.send(JSON.stringify({ type: 'response.output_text.done', text: 'Hello from mock' }));
          }
          if (msg.type === 'input_audio_buffer.commit') {
            socket.send(JSON.stringify({ type: 'input_audio_buffer.committed' }));
          }
        } catch {
          // ignore
        }
      });
    });

    proxyServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => proxyServer.listen(0, () => resolve()));
    proxyPort = (proxyServer.address() as { port: number }).port;
    createOpenAIProxyServer({
      server: proxyServer,
      path: PROXY_PATH,
      upstreamUrl: `ws://localhost:${mockPort}`,
    });
  });

  afterAll(async () => {
    if (mockWss) mockWss.close();
    if (mockUpstreamServer) mockUpstreamServer.close();
    if (proxyServer) await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
  }, 5000);

  it('listens on configured path and accepts WebSocket upgrade', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      expect(client.readyState).toBe(1); // OPEN
      client.close();
      done();
    });
    client.on('error', done);
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
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        expect(msg.type).toBe('SettingsApplied');
        client.close();
        done();
      }
    });
    client.on('error', done);
  });

  it('translates InjectUserMessage to conversation.item.create + response.create and response.output_text.done to ConversationText', (done) => {
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    let gotSettingsApplied = false;
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; content?: string };
      if (msg.type === 'SettingsApplied') {
        gotSettingsApplied = true;
        client.send(JSON.stringify({ type: 'InjectUserMessage', content: 'hi' }));
      }
      if (msg.type === 'ConversationText' && msg.role === 'assistant') {
        expect(msg.content).toBe('Hello from mock');
        client.close();
        done();
      }
    });
    client.on('error', done);
  });

  it('translates binary client message to input_audio_buffer.append and after debounce sends commit + response.create', (done) => {
    mockReceived.length = 0;
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === 'SettingsApplied') {
        client.send(Buffer.from([0x00, 0x00, 0xff, 0xff]));
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

  it('translates response.function_call_arguments.done to FunctionCallRequest and FunctionCallResponse to conversation.item.create (function_call_output)', (done) => {
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
  it('sends FunctionCallRequest then ConversationText when upstream sends response.function_call_arguments.done (client receives both)', (done) => {
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
  it('sends only ConversationText when upstream sends only output_audio_transcript.done with "Function call: ..." (no FunctionCallRequest)', (done) => {
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
  it('sends only ConversationText when upstream sends only output_text.done with "Function call: ..." (no FunctionCallRequest)', (done) => {
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
  it('sends ConversationText then FunctionCallRequest then ConversationText when upstream sends transcript.done then function_call_arguments.done', (done) => {
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
    const userContent = 'My favorite color is blue';
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'Settings', agent: { think: { prompt: 'Hi' } } }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string };
      if (msg.type === 'SettingsApplied') {
        client.send(JSON.stringify({ type: 'InjectUserMessage', content: userContent }));
      }
      if (msg.type === 'ConversationText' && msg.role === 'user') {
        expect(msg.content).toBe(userContent);
        client.close();
        done();
      }
    });
    client.on('error', done);
  });

  it('sends Settings.agent.context.messages as conversation.item.create to upstream', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
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
    client.on('error', done);
  });

  /**
   * Greeting (Issue #381): When Settings includes agent.greeting, after session.updated the proxy
   * sends SettingsApplied, then injects the greeting as ConversationText (assistant) to the client
   * and as conversation.item.create (assistant) to upstream.
   */
  it('injects agent.greeting as ConversationText and conversation.item.create after session.updated', (done) => {
    mockReceived.length = 0;
    receivedConversationItems.length = 0;
    const greeting = 'Hello! How can I help you today?';
    const client = new WebSocket(`ws://localhost:${proxyPort}${PROXY_PATH}`);
    client.on('open', () => {
      client.send(JSON.stringify({
        type: 'Settings',
        agent: { think: { prompt: 'Hi' }, greeting },
      }));
    });
    client.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as { type?: string; role?: string; content?: string };
      if (msg.type === 'SettingsApplied') {
        // After SettingsApplied we expect proxy to send ConversationText (assistant, greeting)
        // and to send conversation.item.create (assistant, greeting) to upstream.
      }
      if (msg.type === 'ConversationText' && msg.role === 'assistant' && msg.content === greeting) {
        expect(msg.content).toBe(greeting);
        // Defer so upstream (mock) has processed proxy's conversation.item.create
        setImmediate(() => {
          const greetingItem = receivedConversationItems.find(
            (m) => m.item?.type === 'message' && m.item?.role === 'assistant'
          );
          expect(greetingItem).toBeDefined();
          const textContent = greetingItem?.item && 'content' in greetingItem.item && Array.isArray(greetingItem.item.content)
            ? greetingItem.item.content[0]?.text
            : undefined;
          expect(textContent).toBe(greeting);
          client.close();
          done();
        });
      }
    });
    client.on('error', done);
  });
});
