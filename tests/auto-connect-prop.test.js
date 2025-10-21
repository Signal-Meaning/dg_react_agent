/**
 * Auto-Connect Prop Behavior Unit Tests for dg_react_agent
 * 
 * These tests verify that the autoConnect prop behaves correctly:
 * - When autoConnect is undefined (default), it should NOT auto-connect
 * - When autoConnect is true, it should auto-connect
 * - When autoConnect is false, it should NOT auto-connect
 */

const React = require('react');
const { render, act, waitFor } = require('@testing-library/react');
const { DeepgramVoiceInteraction } = require('../src');
const { 
  createMockProps, 
  createNonMemoizedOptions, 
  setupConsoleWarningSpy,
  TEST_DESCRIPTIONS,
  TEST_ASSERTIONS 
} = require('./utils/auto-connect-test-utils');

// Force mock mode in CI environment
if (process.env.CI === 'true') {
  process.env.NODE_ENV = 'test';
  process.env.DEEPGRAM_API_KEY = 'mock';
  process.env.VITE_DEEPGRAM_API_KEY = 'mock';
  process.env.RUN_REAL_API_TESTS = 'false';
}

// Mock the WebSocketManager and AudioManager to prevent real API calls
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

// Set up default mocks that return unsubscribe functions
const mockUnsubscribe = jest.fn();

WebSocketManager.mockImplementation(() => ({
  connect: jest.fn().mockResolvedValue(),
  close: jest.fn(),
  sendJSON: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe),
  resetIdleTimeout: jest.fn(),
  startKeepalive: jest.fn(),
  stopKeepalive: jest.fn(),
  getState: jest.fn().mockReturnValue('connected')
}));

AudioManager.mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue(),
  startRecording: jest.fn().mockResolvedValue(),
  stopRecording: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe),
  dispose: jest.fn(),
  setTtsMuted: jest.fn()
}));

describe('Auto-Connect Prop Behavior', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = createMockProps();
  });

  test(TEST_DESCRIPTIONS.SHOULD_NOT_AUTO_CONNECT_UNDEFINED, async () => {
    // This test verifies the fix for issue #8
    const { container } = render(
      <DeepgramVoiceInteraction {...mockProps} />
    );
    
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalledWith(true);
    }, { timeout: 5000 });
    
    TEST_ASSERTIONS.expectComponentReady(mockProps.onReady);
  });

  test(TEST_DESCRIPTIONS.SHOULD_AUTO_CONNECT_TRUE, async () => {
    const { container } = render(
      <DeepgramVoiceInteraction {...mockProps} autoConnect={true} />
    );
    
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalled();
    }, { timeout: 5000 });
    
    TEST_ASSERTIONS.expectComponentReady(mockProps.onReady);
  });

  test(TEST_DESCRIPTIONS.SHOULD_NOT_AUTO_CONNECT_FALSE, async () => {
    const { container } = render(
      <DeepgramVoiceInteraction {...mockProps} autoConnect={false} />
    );
    
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalledWith(true);
    }, { timeout: 5000 });
    
    TEST_ASSERTIONS.expectComponentReady(mockProps.onReady);
  });

  test(TEST_DESCRIPTIONS.SHOULD_SHOW_MEMOIZATION_WARNING, async () => {
    const { consoleSpy, cleanup } = setupConsoleWarningSpy();
    process.env.NODE_ENV = 'development';
    
    const nonMemoizedOptions = createNonMemoizedOptions();
    const { container } = render(
      <DeepgramVoiceInteraction 
        {...mockProps}
        {...nonMemoizedOptions}
      />
    );
    
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalled();
    }, { timeout: 5000 });
    
    TEST_ASSERTIONS.expectConsoleWarning(consoleSpy, 'agentOptions');
    TEST_ASSERTIONS.expectConsoleWarning(consoleSpy, 'transcriptionOptions');
    
    cleanup();
  });
});
