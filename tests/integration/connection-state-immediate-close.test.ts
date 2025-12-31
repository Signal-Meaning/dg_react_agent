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
 * 
 * TESTING APPROACH:
 * =================
 * This test uses a mock WebSocket controlled by a global flag `shouldCloseImmediately`.
 * 
 * - When `shouldCloseImmediately = true`: Mock simulates the defect (closes immediately)
 *   → Tests expecting stable connections FAIL (demonstrating the defect)
 * 
 * - When `shouldCloseImmediately = false`: Mock behaves correctly (doesn't close immediately)
 *   → Tests expecting stable connections PASS (baseline test)
 * 
 * IMPORTANT LIMITATION:
 * The test that passes when `shouldCloseImmediately = false` only verifies that our
 * mock works correctly. It does NOT verify that the real defect in production is fixed.
 * The actual defect still exists in the real code - we're just controlling whether
 * our mock simulates it or not.
 * 
 * To truly verify the defect is fixed, we would need:
 * 1. E2E tests with real WebSocket connections, OR
 * 2. Tests that trigger the actual root cause of the immediate close
 */

import { WebSocketManager, WebSocketManagerOptions } from '../../src/utils/websocket/WebSocketManager';

// Global flag to control whether WebSocket should close immediately
let shouldCloseImmediately = false;

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
      if (shouldCloseImmediately) {
        this.closeTimer = setTimeout(() => {
          this.readyState = MockWebSocket.CLOSED;
          if (this.onclose) {
            this.onclose(new CloseEvent('close', { code: 1005, reason: 'Abnormal closure' }));
          }
        }, 150); // Close after 150ms (within 100-200ms range)
      }
    }, 10);
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
    shouldCloseImmediately = false; // Reset to default
  });

  afterEach(() => {
    if (manager) {
      manager.close();
    }
  });

  describe('Issue #341: Connection Closes Immediately After Being Reported as Connected', () => {
    it('should maintain stable connection after being reported as connected (FAILS when defect is present)', async () => {
      // Arrange: Set global flag so WebSocket will close immediately after opening (simulating defect)
      shouldCloseImmediately = true;

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

      // Wait a bit longer to verify connection remains stable
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms

      // Assert: Connection should remain stable (correct behavior)
      // This test FAILS when defect is present (connection closes immediately)
      // This test PASSES when defect is fixed (connection remains stable)
      const lastState = connectionStates[connectionStates.length - 1];
      expect(lastState).toBe('connected');
      
      // Verify connection did NOT close immediately
      expect(connectionStates).not.toContain('closed');

      unsubscribe();
    });

    it('should maintain stable connection when mock behaves correctly (baseline test)', async () => {
      // Arrange: Set global flag so mock WebSocket will NOT simulate the defect
      // NOTE: This test passes because our mock behaves correctly, NOT because the real defect is fixed
      // The real defect still exists in production - this is just a baseline test
      shouldCloseImmediately = false;

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
      // This test passes because our mock doesn't simulate the defect
      // In reality, the defect still exists - this is just verifying our mock works correctly
      const lastState = connectionStates[connectionStates.length - 1];
      expect(lastState).toBe('connected');
      
      // Verify connection did not close immediately
      expect(connectionStates).not.toContain('closed');

      unsubscribe();
    });

    it('should not transition to closed state immediately after connected (FAILS when defect is present)', async () => {
      // Arrange: Set global flag so WebSocket will close immediately (simulating defect)
      shouldCloseImmediately = true;

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
      
      // Should NOT reach closed immediately after connected (correct behavior)
      // This test FAILS when defect is present (connection closes immediately)
      // This test PASSES when defect is fixed (connection remains stable)
      expect(connectionStates).not.toContain('closed');

      unsubscribe();
    });
  });
});

