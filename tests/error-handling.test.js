/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Error Handling Tests
 * 
 * These tests validate the improved error handling in the component,
 * particularly for missing configuration scenarios.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../src';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Error Handling Tests', () => {
  let mockAgentManager;
  let mockTranscriptionManager;
  let mockAudioManager;
  let mockOnError;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WebSocketManager
    mockAgentManager = {
      connect: jest.fn().mockResolvedValue(),
      sendJSON: jest.fn().mockReturnValue(true),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      triggerTimeoutForTesting: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(() => {}),
    };

    mockTranscriptionManager = {
      connect: jest.fn().mockResolvedValue(),
      sendJSON: jest.fn().mockReturnValue(true),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      triggerTimeoutForTesting: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(() => {}),
    };

    // Mock AudioManager
    mockAudioManager = {
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn().mockResolvedValue(),
      isRecording: jest.fn().mockReturnValue(false),
      isPlaybackActive: jest.fn().mockReturnValue(false),
      isTtsMuted: false,
      getAudioContext: jest.fn().mockReturnValue({
        state: 'running',
        resume: jest.fn().mockResolvedValue()
      }),
    };

    // Mock constructors
    WebSocketManager.mockImplementation((options) => {
      if (options.service === 'agent') return mockAgentManager;
      if (options.service === 'transcription') return mockTranscriptionManager;
      return null;
    });

    AudioManager.mockImplementation(() => mockAudioManager);

    // Mock error handler
    mockOnError = jest.fn();
  });

  test('should succeed but do nothing when no configuration provided', async () => {
    const ref = React.createRef();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        onError={mockOnError}
        debug={true}
      />
    );

    // Wait for component to initialize
    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Attempt to start without any configuration - should succeed but do nothing (original behavior)
    await act(async () => {
      await ref.current.start();
    });

    // Verify error handler was NOT called (no error thrown)
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('should succeed but do nothing when both options are null', async () => {
    const ref = React.createRef();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        agentOptions={null}
        transcriptionOptions={null}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Should succeed but do nothing (original behavior)
    await act(async () => {
      await ref.current.start();
    });

    // Verify error handler was NOT called (no error thrown)
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('should succeed but do nothing when both options are undefined', async () => {
    const ref = React.createRef();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        agentOptions={undefined}
        transcriptionOptions={undefined}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Should succeed but do nothing (original behavior)
    await act(async () => {
      await ref.current.start();
    });

    // Verify error handler was NOT called (no error thrown)
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('should succeed when only agentOptions provided', async () => {
    const ref = React.createRef();
    const agentOptions = {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.'
    };

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        agentOptions={agentOptions}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Should not throw error
    await act(async () => {
      await ref.current.start();
    });

    // Should not call error handler
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('should succeed when only transcriptionOptions provided', async () => {
    const ref = React.createRef();
    const transcriptionOptions = {
      language: 'en',
      model: 'nova-2',
      encoding: 'linear16',
      sample_rate: 16000
    };

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        transcriptionOptions={transcriptionOptions}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Should not throw error
    await act(async () => {
      await ref.current.start();
    });

    // Should not call error handler
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('should succeed when both options provided', async () => {
    const ref = React.createRef();
    const agentOptions = {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.'
    };
    const transcriptionOptions = {
      language: 'en',
      model: 'nova-2',
      encoding: 'linear16',
      sample_rate: 16000
    };

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        agentOptions={agentOptions}
        transcriptionOptions={transcriptionOptions}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Should not throw error
    await act(async () => {
      await ref.current.start();
    });

    // Should not call error handler
    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('should handle empty object configurations', async () => {
    const ref = React.createRef();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        agentOptions={{}}
        transcriptionOptions={{}}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Should not throw error (empty objects are truthy)
    await act(async () => {
      await ref.current.start();
    });
  });

  test('should handle falsy but not null/undefined configurations', async () => {
    const ref = React.createRef();

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        agentOptions={false}
        transcriptionOptions={0}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Should succeed but do nothing (original behavior with falsy values)
    await act(async () => {
      await ref.current.start();
    });
  });

  test('should provide detailed error information', async () => {
    const ref = React.createRef();
    const agentOptions = null;
    const transcriptionOptions = undefined;

    render(
      <DeepgramVoiceInteraction
        ref={ref}
        agentOptions={agentOptions}
        transcriptionOptions={transcriptionOptions}
        onError={mockOnError}
        debug={true}
      />
    );

    await waitFor(() => {
      expect(ref.current).toBeDefined();
    });

    // Attempt to start with mixed null/undefined options - should succeed but do nothing (original behavior)
    await act(async () => {
      await ref.current.start();
    });

    // Verify error handler was NOT called (no error thrown)
    expect(mockOnError).not.toHaveBeenCalled();
  });
});
