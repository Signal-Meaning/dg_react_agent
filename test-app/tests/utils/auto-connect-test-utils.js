/**
 * Shared test utilities for auto-connect prop behavior tests
 * Promotes DRY principles across unit and E2E tests
 */

/**
 * Creates mock props for DeepgramVoiceInteraction component testing
 * @param {Object} overrides - Optional overrides for default props
 * @returns {Object} Mock props object
 */
function createMockProps(overrides = {}) {
  const defaultProps = {
    apiKey: 'test-api-key',
    agentOptions: {
      language: 'en',
      listenModel: 'nova-3',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-2-apollo-en',
      instructions: 'You are a helpful assistant',
      greeting: 'Hello! How can I help you?'
    },
    onReady: jest.fn(),
    onConnectionStateChange: jest.fn(),
    onAgentStateChange: jest.fn(),
    onError: jest.fn(),
    debug: false
  };

  return { ...defaultProps, ...overrides };
}

/**
 * Creates non-memoized options for testing memoization warnings
 * @returns {Object} Object with non-memoized options
 */
function createNonMemoizedOptions() {
  return {
    agentOptions: {
      language: 'en',
      listenModel: 'nova-3'
    },
    transcriptionOptions: {
      model: 'nova-2',
      language: 'en-US'
    }
  };
}

/**
 * Sets up console warning spy for testing
 * @returns {Object} Console spy and cleanup function
 */
function setupConsoleWarningSpy() {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const originalEnv = process.env.NODE_ENV;
  
  return {
    consoleSpy,
    cleanup: () => {
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    }
  };
}

/**
 * Common test descriptions for auto-connect behavior
 */
const TEST_DESCRIPTIONS = {
  SHOULD_NOT_AUTO_CONNECT_UNDEFINED: 'should NOT auto-connect when autoConnect is undefined (default behavior)',
  SHOULD_AUTO_CONNECT_TRUE: 'should auto-connect when autoConnect is explicitly true',
  SHOULD_NOT_AUTO_CONNECT_FALSE: 'should NOT auto-connect when autoConnect is explicitly false',
  SHOULD_SHOW_MEMOIZATION_WARNING: 'should show development warning for non-memoized options'
};

/**
 * Common test assertions for auto-connect behavior
 */
const TEST_ASSERTIONS = {
  expectComponentReady: (onReadyMock) => {
    expect(onReadyMock).toHaveBeenCalledWith(true);
  },
  
  expectConsoleWarning: (consoleSpy, propName) => {
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${propName} prop detected`)
    );
  }
};

export {
  createMockProps,
  createNonMemoizedOptions,
  setupConsoleWarningSpy,
  TEST_DESCRIPTIONS,
  TEST_ASSERTIONS
};
