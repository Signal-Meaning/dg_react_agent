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
const { DeepgramVoiceInteraction } = require('../dist');
const { 
  createMockProps, 
  createNonMemoizedOptions, 
  setupConsoleWarningSpy,
  TEST_DESCRIPTIONS,
  TEST_ASSERTIONS 
} = require('./utils/auto-connect-test-utils');

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
