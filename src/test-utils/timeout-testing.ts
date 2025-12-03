/**
 * Test utilities for WebSocket timeout testing
 * These should only be used in test environments
 */

import { WebSocketManager } from '../utils/websocket/WebSocketManager';

/**
 * Test-only utility to trigger timeout for testing
 * This creates a temporary WebSocketManager instance for testing purposes
 */
export function triggerTimeoutForTesting(webSocketManager: WebSocketManager): void {
  if (!webSocketManager) {
    throw new Error('WebSocketManager instance is required for testing');
  }
  
  // Stop keepalive and close the connection
  webSocketManager.stopKeepalive();
  if (webSocketManager.isConnected()) {
    webSocketManager.close();
  }
}

/**
 * Test-only utility to create a WebSocketManager for testing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTestWebSocketManager(options: any): WebSocketManager {
  return new WebSocketManager(options);
}
