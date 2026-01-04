/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * WebSocket Binary JSON Message Handling Tests - Issue #353
 * 
 * Unit tests for WebSocketManager binary JSON message handling using ArrayBuffer.
 * 
 * Note: Blob tests are in Playwright E2E tests (test-app/tests/e2e/issue-353-binary-json-messages.spec.js)
 * because Blob.arrayBuffer() requires real browser APIs that jsdom doesn't fully support.
 * 
 * Test scenarios (ArrayBuffer only):
 * 1. Binary ArrayBuffer containing JSON FunctionCallRequest should be parsed and routed as 'message' event
 * 2. Binary ArrayBuffer containing other agent message types (SettingsApplied, ConversationText, etc.)
 * 3. Binary data that is not valid JSON should be routed as 'binary' event
 * 4. Binary data that is JSON but not an agent message should be routed as 'binary' event
 * 5. Text JSON messages should continue to work (backward compatibility)
 * 6. Error handling (invalid UTF-8, malformed JSON, etc.)
 * 7. Edge cases (empty binary, very large binary, etc.)
 */

import { WebSocketManager, WebSocketManagerOptions } from '../src/utils/websocket/WebSocketManager';

// Simple TextEncoder/TextDecoder polyfill for jsdom (minimal, only for ArrayBuffer tests)
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      const utf8: number[] = [];
      for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        } else {
          i++;
          charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        }
      }
      return new Uint8Array(utf8);
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(data: ArrayBuffer | Uint8Array): string {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      let result = '';
      for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i]);
      }
      return result;
    }
  };
}

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol: string;
  extensions: string;
  binaryType: 'blob' | 'arraybuffer' = 'arraybuffer';
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private messageQueue: Array<{ data: string | ArrayBuffer; type: string }> = [];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string | ArrayBuffer | Blob): void {
    this.messageQueue.push({ data: data as any, type: typeof data === 'string' ? 'string' : 'binary' });
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
    }
  }

  addEventListener(): void {
    // Mock implementation
  }

  removeEventListener(): void {
    // Mock implementation
  }

  // Helper method to simulate receiving a message
  simulateMessage(data: string | ArrayBuffer): void {
    if (this.onmessage) {
      const event = new MessageEvent('message', { data });
      this.onmessage(event);
    }
  }

  // Helper method to simulate receiving a binary ArrayBuffer with JSON
  simulateBinaryArrayBufferMessage(jsonString: string): void {
    if (this.onmessage) {
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(jsonString).buffer;
      const event = new MessageEvent('message', { data: arrayBuffer });
      this.onmessage(event);
    }
  }
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('WebSocket Binary JSON Message Handling - Issue #353 (ArrayBuffer Tests)', () => {
  let manager: WebSocketManager;
  let receivedEvents: Array<{ type: string; data?: any }> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    receivedEvents = [];
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
  });

  // Helper to wait for connection
  const waitForConnection = async (manager: WebSocketManager): Promise<void> => {
    await manager.connect();
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 1000);
      const unsubscribe = manager.addEventListener((event) => {
        if (event.type === 'state' && event.state === 'connected') {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  };

  // Helper to wait for events
  const waitForEvents = (ms: number = 200): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  describe('FunctionCallRequest binary JSON handling (ArrayBuffer)', () => {
    it('should parse binary ArrayBuffer containing FunctionCallRequest JSON and emit as message event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [{
          id: 'call_456',
          name: 'search_products',
          arguments: '{"query": "shoes"}',
          client_side: true
        }]
      };
      const jsonString = JSON.stringify(functionCallRequest);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateBinaryArrayBufferMessage(jsonString);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message');
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      expect(messageEvents.length).toBeGreaterThan(0);
      expect(binaryEvents.length).toBe(0);
      
      const messageEvent = messageEvents.find(e => e.data?.type === 'FunctionCallRequest');
      expect(messageEvent).toBeDefined();
      expect(messageEvent?.data?.type).toBe('FunctionCallRequest');
      expect(messageEvent?.data?.functions).toBeDefined();
      expect(messageEvent?.data?.functions.length).toBe(1);

      unsubscribe();
    }, 10000);
  });

  describe('Other agent message types in binary JSON (ArrayBuffer)', () => {
    it('should parse binary ArrayBuffer containing SettingsApplied JSON and emit as message event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      const settingsApplied = {
        type: 'SettingsApplied'
      };
      const jsonString = JSON.stringify(settingsApplied);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateBinaryArrayBufferMessage(jsonString);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message');
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      expect(messageEvents.length).toBeGreaterThan(0);
      expect(binaryEvents.length).toBe(0);
      
      const messageEvent = messageEvents.find(e => e.data?.type === 'SettingsApplied');
      expect(messageEvent).toBeDefined();
      expect(messageEvent?.data?.type).toBe('SettingsApplied');

      unsubscribe();
    }, 10000);

    it('should parse binary ArrayBuffer containing ConversationText JSON and emit as message event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      const conversationText = {
        type: 'ConversationText',
        role: 'assistant',
        content: 'Hello, how can I help you?'
      };
      const jsonString = JSON.stringify(conversationText);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateBinaryArrayBufferMessage(jsonString);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message');
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      expect(messageEvents.length).toBeGreaterThan(0);
      expect(binaryEvents.length).toBe(0);
      
      const messageEvent = messageEvents.find(e => e.data?.type === 'ConversationText');
      expect(messageEvent).toBeDefined();
      expect(messageEvent?.data?.type).toBe('ConversationText');
      expect(messageEvent?.data?.role).toBe('assistant');

      unsubscribe();
    }, 10000);

    it('should parse binary ArrayBuffer containing Error JSON and emit as message event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      const errorMessage = {
        type: 'Error',
        message: 'Something went wrong',
        code: 'ERROR_CODE'
      };
      const jsonString = JSON.stringify(errorMessage);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateBinaryArrayBufferMessage(jsonString);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message');
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      expect(messageEvents.length).toBeGreaterThan(0);
      expect(binaryEvents.length).toBe(0);
      
      const messageEvent = messageEvents.find(e => e.data?.type === 'Error');
      expect(messageEvent).toBeDefined();
      expect(messageEvent?.data?.type).toBe('Error');

      unsubscribe();
    }, 10000);
  });

  describe('Non-JSON binary data handling', () => {
    it('should route binary ArrayBuffer that is not valid JSON as binary event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      // Simulate receiving binary audio data (not JSON)
      const audioData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      const arrayBuffer = audioData.buffer;
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateMessage(arrayBuffer);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message' && e.data?.type);
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      expect(binaryEvents.length).toBeGreaterThan(0);
      expect(messageEvents.filter(e => e.data?.type === 'FunctionCallRequest').length).toBe(0);

      unsubscribe();
    }, 10000);

    it('should route binary data with invalid UTF-8 as binary event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      // Create binary data with invalid UTF-8 sequences
      const invalidUtf8 = new Uint8Array([0xFF, 0xFE, 0xFD]);
      const arrayBuffer = invalidUtf8.buffer;
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateMessage(arrayBuffer);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message' && e.data?.type);
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      expect(binaryEvents.length).toBeGreaterThan(0);
      expect(messageEvents.filter(e => e.data?.type).length).toBe(0);

      unsubscribe();
    }, 10000);
  });

  describe('Non-agent JSON in binary data', () => {
    it('should route binary JSON that is not an agent message as binary event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      // JSON without 'type' field should route as binary
      const nonAgentMessage = {
        data: 'not an agent message',
        someField: 'value'
      };
      const jsonString = JSON.stringify(nonAgentMessage);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateBinaryArrayBufferMessage(jsonString);
      await waitForEvents();

      // Should route as binary since it doesn't have a 'type' field
      const messageEvents = receivedEvents.filter(e => e.type === 'message' && e.data?.type);
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      // JSON without 'type' field should route as binary
      expect(binaryEvents.length).toBeGreaterThan(0);

      unsubscribe();
    }, 10000);

    it('should route binary JSON with malformed structure as binary event', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      // Malformed JSON string (not valid JSON)
      const malformedJson = '{"type": "FunctionCallRequest", "functions": [}';
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(malformedJson).buffer;
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateMessage(arrayBuffer);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message' && e.data?.type === 'FunctionCallRequest');
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      // Should route as binary since JSON parsing will fail
      expect(messageEvents.length).toBe(0);
      expect(binaryEvents.length).toBeGreaterThan(0);

      unsubscribe();
    }, 10000);
  });

  describe('Backward compatibility', () => {
    it('should continue to handle text JSON messages correctly', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      const functionCallRequest = {
        type: 'FunctionCallRequest',
        functions: [{
          id: 'call_789',
          name: 'get_weather',
          arguments: '{"location": "San Francisco"}',
          client_side: true
        }]
      };
      const jsonString = JSON.stringify(functionCallRequest);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateMessage(jsonString);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message');
      
      expect(messageEvents.length).toBeGreaterThan(0);
      
      const messageEvent = messageEvents.find(e => e.data?.type === 'FunctionCallRequest');
      expect(messageEvent).toBeDefined();
      expect(messageEvent?.data?.type).toBe('FunctionCallRequest');
      expect(messageEvent?.data?.functions).toBeDefined();
      expect(messageEvent?.data?.functions.length).toBe(1);

      unsubscribe();
    }, 10000);
  });

  describe('Edge cases', () => {
    it('should handle empty binary data gracefully', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      const emptyArrayBuffer = new ArrayBuffer(0);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateMessage(emptyArrayBuffer);
      await waitForEvents();

      const messageEvents = receivedEvents.filter(e => e.type === 'message' && e.data?.type);
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      // Empty data should route as binary
      expect(binaryEvents.length).toBeGreaterThan(0);
      expect(messageEvents.length).toBe(0);

      unsubscribe();
    }, 10000);

    it('should handle very large binary JSON messages', async () => {
      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);
      const unsubscribe = manager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      await waitForConnection(manager);

      // Create a large FunctionCallRequest with many functions
      const largeFunctionCallRequest = {
        type: 'FunctionCallRequest',
        functions: Array.from({ length: 100 }, (_, i) => ({
          id: `call_${i}`,
          name: `function_${i}`,
          arguments: JSON.stringify({ index: i, data: 'x'.repeat(1000) }),
          client_side: true
        }))
      };
      const jsonString = JSON.stringify(largeFunctionCallRequest);
      
      const mockWs = (manager as any).ws as MockWebSocket;
      mockWs.simulateBinaryArrayBufferMessage(jsonString);
      await waitForEvents(500); // Wait longer for large message

      const messageEvents = receivedEvents.filter(e => e.type === 'message');
      const binaryEvents = receivedEvents.filter(e => e.type === 'binary');
      
      expect(messageEvents.length).toBeGreaterThan(0);
      expect(binaryEvents.length).toBe(0);
      
      const messageEvent = messageEvents.find(e => e.data?.type === 'FunctionCallRequest');
      expect(messageEvent).toBeDefined();
      expect(messageEvent?.data?.functions.length).toBe(100);

      unsubscribe();
    }, 15000);
  });
});
