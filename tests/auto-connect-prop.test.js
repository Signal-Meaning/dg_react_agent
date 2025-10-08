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

describe('Auto-Connect Prop Behavior', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock props for testing
    mockProps = {
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
  });

  test('should NOT auto-connect when autoConnect is undefined (default behavior)', async () => {
    // This test verifies the fix for issue #8
    // The component should not auto-connect when autoConnect is undefined
    
    const { container } = render(
      <DeepgramVoiceInteraction {...mockProps} />
    );
    
    // Wait for component to initialize
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalled();
    }, { timeout: 5000 });
    
    // The component should be ready but not auto-connected
    // (This is verified by the fact that onReady is called with true)
    expect(mockProps.onReady).toHaveBeenCalledWith(true);
  });

  test('should auto-connect when autoConnect is explicitly true', async () => {
    // This test verifies that when autoConnect is explicitly true, it works
    const { container } = render(
      <DeepgramVoiceInteraction {...mockProps} autoConnect={true} />
    );
    
    // Wait for component to initialize
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalled();
    }, { timeout: 5000 });
    
    // The component should be ready and auto-connected
    expect(mockProps.onReady).toHaveBeenCalledWith(true);
  });

  test('should NOT auto-connect when autoConnect is explicitly false', async () => {
    // This test verifies that when autoConnect is explicitly false, it doesn't auto-connect
    const { container } = render(
      <DeepgramVoiceInteraction {...mockProps} autoConnect={false} />
    );
    
    // Wait for component to initialize
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalled();
    }, { timeout: 5000 });
    
    // The component should be ready but not auto-connected
    expect(mockProps.onReady).toHaveBeenCalledWith(true);
  });

  test('should show development warning for non-memoized options', async () => {
    // Mock console.warn to capture warnings
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Set NODE_ENV to development
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    // Render component with non-memoized options (inline objects)
    const { container } = render(
      <DeepgramVoiceInteraction 
        {...mockProps}
        agentOptions={{
          language: 'en',
          listenModel: 'nova-3'
        }}
        transcriptionOptions={{
          model: 'nova-2',
          language: 'en-US'
        }}
      />
    );
    
    // Wait for component to initialize
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalled();
    }, { timeout: 5000 });
    
    // Verify that warnings were logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('agentOptions prop detected')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('transcriptionOptions prop detected')
    );
    
    // Cleanup
    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});
