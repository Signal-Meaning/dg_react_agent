/**
 * Stable Mock Fixtures
 * 
 * DRY mock implementations for testing.
 * These match the PRE-FORK API surface (commit 7191eb4).
 */

/**
 * WebSocketManager mock matching pre-fork public API
 * Source: commit 7191eb4a062f35344896e873f02eba69c9c46a2d
 */
export const createMockWebSocketManager = () => ({
  // Pre-fork public methods
  addEventListener: jest.fn().mockReturnValue(jest.fn()),
  connect: jest.fn().mockResolvedValue(undefined),
  sendJSON: jest.fn(),
  sendBinary: jest.fn(),
  sendCloseStream: jest.fn(),
  close: jest.fn(),
  getState: jest.fn().mockReturnValue('connected'),
  // WebSocket readyState (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED). Component uses this to decide when to send Settings.
  getReadyState: jest.fn().mockReturnValue(1), // OPEN
  
  // Post-fork additions (may need verification)
  isConnected: jest.fn().mockReturnValue(true),
  destroy: jest.fn(),
  startKeepalive: jest.fn(),
  stopKeepalive: jest.fn(),
  
  // Issue #345: Settings wait helper method
  hasSettingsBeenSent: jest.fn().mockReturnValue(false),
  
  // WebSocket property for readyState checking (required for Settings sending)
  // Component checks agentManagerRef.current.ws.readyState before sending Settings
  // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
  ws: {
    readyState: 1, // OPEN - allows Settings to be sent
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
});

/**
 * AudioManager mock matching pre-fork API
 * Source: commit 7191eb4 - these methods existed pre-fork
 */
export const createMockAudioManager = () => ({
  // Pre-fork public methods (commit 7191eb4)
  addEventListener: jest.fn().mockReturnValue(jest.fn()),
  initialize: jest.fn().mockResolvedValue(undefined),
  startRecording: jest.fn().mockResolvedValue(undefined),
  stopRecording: jest.fn(),
  queueAudio: jest.fn().mockResolvedValue(undefined),
  clearAudioQueue: jest.fn(),
  dispose: jest.fn(),
  isRecordingActive: jest.fn().mockReturnValue(false),

  getAudioContext: jest.fn().mockReturnValue({
    state: 'running',
    suspend: jest.fn(),
    resume: jest.fn(),
  }),
  abortPlayback: jest.fn(),
});

/**
 * AgentOptions fixture
 */
export const createMockAgentOptions = () => ({
  language: 'en',
  listenModel: 'nova-2',
  thinkProviderType: 'open_ai',
  thinkModel: 'gpt-4o-mini',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.',
});

/**
 * Mock API key for testing
 */
export const MOCK_API_KEY = 'mock-deepgram-api-key-for-testing-only';

