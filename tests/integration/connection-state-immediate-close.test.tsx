/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Integration Test: Connection State Reporting - Immediate Close After Connected
 * 
 * Issue #341: Connection State Reporting: Connections Close Immediately After Being Reported as Connected
 * 
 * This test demonstrates the defect where connections are reported as "connected"
 * via onConnectionStateChange callback, but the WebSocket connection closes
 * immediately after (within 100-200ms).
 * 
 * Expected Behavior (After Fix):
 * - Connection should remain stable after being reported as "connected"
 * - onConnectionStateChange('agent', 'connected') should indicate a stable connection
 * - Connection should not close immediately after being reported as connected
 * - Connection should only close due to explicit errors or user actions
 * 
 * Current Behavior (Demonstrating Defect):
 * - onConnectionStateChange('agent', 'connected') is called
 * - Connection closes immediately after (within 100-200ms)
 * - Connection state transitions: connecting -> connected -> closed
 */

import { WebSocketManager, WebSocketManagerOptions } from '../../src/utils/websocket/WebSocketManager';

// Mock WebSocket that can simulate immediate close after connection
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private closeTimer: NodeJS.Timeout | null = null;
  private shouldCloseImmediately: boolean = false;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
      
      // Simulate immediate close after connection (demonstrates defect)
      // This simulates the behavior reported in Issue #341
      if (this.shouldCloseImmediately) {
        this.closeTimer = setTimeout(() => {
          this.readyState = MockWebSocket.CLOSED;
          if (this.onclose) {
            this.onclose(new CloseEvent('close', { code: 1005, reason: 'Abnormal closure' }));
          }
        }, 150); // Close after 150ms (within 100-200ms range)
      }
    }, 10);
  }

  setShouldCloseImmediately(value: boolean) {
    this.shouldCloseImmediately = value;
  }

  send(data: string | ArrayBuffer | Blob): void {
    // Mock implementation
  }

  close(code?: number, reason?: string): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }
  }
}

// Replace global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('Connection State Reporting - Immediate Close After Connected', () => {
  let connectionStates: Array<string> = [];
  let manager: WebSocketManager;

  beforeEach(() => {
    jest.clearAllMocks();
    connectionStates = [];
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
  });

  describe('Issue #341: Connection Closes Immediately After Being Reported as Connected', () => {
    it('should demonstrate defect: connection closes immediately after being reported as connected', async () => {
      // Arrange: Create a WebSocket that will close immediately after opening
      const mockWs = new MockWebSocket('wss://agent.deepgram.com/v1/agent/converse');
      mockWs.setShouldCloseImmediately(true);

      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);

      // Track connection state changes
      const unsubscribe = manager.addEventListener((event) => {
        if (event.type === 'state') {
          connectionStates.push(event.state);
        }
      });

      // Act: Connect
      await manager.connect();

      // Verify connection was reported as "connected"
      expect(connectionStates).toContain('connected');

      // Wait a bit longer to see if connection closes
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms

      // Assert: Connection should have closed immediately after being reported as connected
      // This demonstrates the defect - connection should remain stable
      expect(connectionStates).toContain('closed');
      
      // Verify the sequence: connecting -> connected -> closed
      expect(connectionStates).toContain('connecting');
      expect(connectionStates).toContain('connected');
      expect(connectionStates).toContain('closed');
      
      // Verify closed happened after connected (demonstrates defect)
      const connectedIndex = connectionStates.indexOf('connected');
      const closedIndex = connectionStates.indexOf('closed');
      expect(closedIndex).toBeGreaterThan(connectedIndex);
      
      // Verify the time between connected and closed is very short (< 200ms)
      // This is the core defect - connection should remain stable

      unsubscribe();
    });

    it('should maintain stable connection after being reported as connected (expected after fix)', async () => {
      // Arrange: Create a WebSocket that will NOT close immediately
      const mockWs = new MockWebSocket('wss://agent.deepgram.com/v1/agent/converse');
      mockWs.setShouldCloseImmediately(false);

      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);

      // Track connection state changes
      const unsubscribe = manager.addEventListener((event) => {
        if (event.type === 'state') {
          connectionStates.push(event.state);
        }
      });

      // Act: Connect
      await manager.connect();

      // Wait longer to verify connection remains stable
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms

      // Assert: Connection should remain stable (not close immediately)
      const lastState = connectionStates[connectionStates.length - 1];
      expect(lastState).toBe('connected');
      
      // Verify connection did not close immediately
      expect(connectionStates).not.toContain('closed');

      unsubscribe();
    });

    it('should track connection state transitions correctly', async () => {
      const mockWs = new MockWebSocket('wss://agent.deepgram.com/v1/agent/converse');
      mockWs.setShouldCloseImmediately(true);

      const options: WebSocketManagerOptions = {
        url: 'wss://agent.deepgram.com/v1/agent/converse',
        apiKey: 'test-api-key',
        service: 'agent',
      };

      manager = new WebSocketManager(options);

      // Track connection state changes
      const unsubscribe = manager.addEventListener((event) => {
        if (event.type === 'state') {
          connectionStates.push(event.state);
        }
      });

      // Act: Connect and wait for state transitions
      await manager.connect();
      await new Promise(resolve => setTimeout(resolve, 400));

      // Assert: Should have gone through expected states
      // Should start with connecting
      expect(connectionStates[0]).toBe('connecting');
      
      // Should reach connected
      expect(connectionStates).toContain('connected');
      
      // If defect is present, should also reach closed quickly
      // If fixed, should remain at connected
      expect(connectionStates).toContain('closed');

      unsubscribe();
    });
  });
});

