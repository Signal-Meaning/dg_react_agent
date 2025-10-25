/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

// Skip in CI until proper mocks are implemented (Issue #99)
const shouldSkipInCI = process.env.CI && !process.env.RUN_REAL_API_TESTS;

/**
 * Duplicate Settings Prevention Tests
 * 
 * This test suite validates that settings are not sent multiple times to the Deepgram agent,
 * which would cause a SETTINGS_ALREADY_APPLIED error and prevent proper microphone functionality.
 * 
 * NOTE: Some tests are skipped due to premature mocking issues. The skipped tests
 * expect auto-connect to send initial settings, but our mocks don't accurately
 * reflect the real API behavior. This is a classic example of creating integration
 * tests with mocks before understanding the actual API behavior.
 * 
 * TODO: Complete mock tests based on real API behavior
 * - E2E tests confirm auto-connect works correctly with real API (16/16 passing)
 * - Need to create proper mocks that reflect actual API behavior
 * - See GitHub issue: https://github.com/Signal-Meaning/dg_react_agent/issues/49
 * 
 * See: tests/e2e/auto-connect-behavior.spec.js for real API tests
 * See: tests/e2e/microphone-functionality.spec.js for settings behavior validation
 * 
 * Key Scenarios Tested:
 * ====================
 * 
 * 1. AUTO-CONNECT + CONNECTION STATE HANDLER
 *    - Both auto-connect timeout and connection state handler should not send settings
 *    - Only one should send settings, the other should be skipped
 * 
 * 2. RESUME WITH AUDIO + CONNECTION STATE HANDLER  
 *    - resumeWithAudio should not send settings if they're already sent
 *    - Connection state handler should not send settings if already sent
 * 
 * 3. TOGGLE MIC + CONNECTION STATE HANDLER
 *    - toggleMic fallback should not send settings if already sent
 *    - Connection state handler should not send settings if already sent
 * 
 * 4. MULTIPLE CONNECTION EVENTS
 *    - Multiple connection state changes should not cause duplicate settings
 *    - hasSentSettings flag should prevent duplicate sends
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

(shouldSkipInCI ? describe.skip : describe)('Duplicate Settings Prevention', () => {
  const mockApiKey = 'mock-deepgram-api-key-for-testing-purposes-only';
  const mockAgentOptions = {
    language: 'en',
    listenModel: 'nova-2',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    greeting: 'Hello! How can I help you today?'
  };

  const defaultProps = {
    apiKey: mockApiKey,
    agentOptions: mockAgentOptions,
    debug: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear global state to prevent interference between tests
    window.globalAutoConnectAttempted = false;
    window.globalSettingsSent = false;
  });

  test('should not send settings twice when auto-connect and connection state handler both trigger', async () => {
    const mockSendJSON = jest.fn();
    const mockAddEventListener = jest.fn();
    
    // Mock WebSocketManager to simulate connection events
    WebSocketManager.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: mockSendJSON,
      addEventListener: mockAddEventListener,
      getState: jest.fn().mockReturnValue('connected')
    }));

    // Mock AudioManager
    AudioManager.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      dispose: jest.fn(),
      setTtsMuted: jest.fn()
    }));

    render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        autoConnect={true}
      />
    );

    // Wait for auto-connect to trigger
    await waitFor(() => {
      expect(mockAddEventListener).toHaveBeenCalled();
    });

    // Simulate connection state change (this should NOT send settings again)
    const stateEventHandler = mockAddEventListener.mock.calls.find(
      call => typeof call[0] === 'function'
    )?.[0];

    if (stateEventHandler) {
      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });
    }

    // Wait a bit for any async operations
    await waitFor(() => {
      // Settings should only be sent ONCE, not twice
      const settingsCalls = mockSendJSON.mock.calls.filter(
        call => call[0].type === 'Settings'
      );
      expect(settingsCalls.length).toBe(1);
    }, { timeout: 2000 });
  });

  test.skip('should not send settings twice when resumeWithAudio and connection state handler both trigger', async () => {
    // TODO: This test is skipped because it requires proper mocking of auto-connect behavior
    // The test expects auto-connect to send initial settings, but our mocks don't accurately
    // reflect the real API behavior. We need to:
    // 1. First verify auto-connect behavior works correctly in E2E tests with real API
    // 2. Then create proper mocks based on the actual API behavior
    // 3. This is an example of premature mocking - creating integration tests with mocks
    //    before understanding the actual API behavior
    // 
    // See: tests/e2e/auto-connect-behavior.spec.js for real API tests
    // See: tests/e2e/microphone-functionality.spec.js for settings behavior validation
    const mockSendJSON = jest.fn();
    const mockAddEventListener = jest.fn();
    
    // Mock WebSocketManager
    WebSocketManager.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: mockSendJSON,
      addEventListener: mockAddEventListener,
      getState: jest.fn().mockReturnValue('connected')
    }));

    // Mock AudioManager
    AudioManager.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      dispose: jest.fn(),
      setTtsMuted: jest.fn()
    }));

    const ref = React.createRef();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        {...defaultProps}
        autoConnect={true}
      />
    );

    // Wait for initialization
    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    // Simulate connection state change to send initial settings
    const stateEventHandler = mockAddEventListener.mock.calls.find(
      call => typeof call[0] === 'function'
    )?.[0];

    if (stateEventHandler) {
      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });
    }

    // Wait for initial settings to be sent
    await waitFor(() => {
      expect(mockSendJSON).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'Settings' })
      );
    });

    // Clear the mock to track new calls
    mockSendJSON.mockClear();

    // Now call resumeWithAudio - this should NOT send settings again
    await act(async () => {
      await ref.current.resumeWithAudio();
    });

    // Simulate another connection state change - this should NOT send settings again
    if (stateEventHandler) {
      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });
    }

    // Settings should NOT be sent again
    await waitFor(() => {
      expect(mockSendJSON).not.toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  test.skip('should not send settings twice when toggleMic fallback and connection state handler both trigger', async () => {
    // TODO: This test is skipped because it requires proper mocking of auto-connect behavior
    // The test expects auto-connect to send initial settings, but our mocks don't accurately
    // reflect the real API behavior. We need to:
    // 1. First verify auto-connect behavior works correctly in E2E tests with real API
    // 2. Then create proper mocks based on the actual API behavior
    // 3. This is an example of premature mocking - creating integration tests with mocks
    //    before understanding the actual API behavior
    // 
    // See: tests/e2e/auto-connect-behavior.spec.js for real API tests
    // See: tests/e2e/microphone-functionality.spec.js for settings behavior validation
    const mockSendJSON = jest.fn();
    const mockAddEventListener = jest.fn();
    
    // Mock WebSocketManager
    WebSocketManager.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: mockSendJSON,
      addEventListener: mockAddEventListener,
      getState: jest.fn().mockReturnValue('connected')
    }));

    // Mock AudioManager
    AudioManager.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      dispose: jest.fn(),
      setTtsMuted: jest.fn()
    }));

    const ref = React.createRef();
    render(
      <DeepgramVoiceInteraction
        ref={ref}
        {...defaultProps}
        autoConnect={true}
      />
    );

    // Wait for initialization
    await waitFor(() => {
      expect(ref.current).toBeTruthy();
    });

    // Simulate connection state change to send initial settings
    const stateEventHandler = mockAddEventListener.mock.calls.find(
      call => typeof call[0] === 'function'
    )?.[0];

    if (stateEventHandler) {
      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });
    }

    // Wait for initial settings to be sent
    await waitFor(() => {
      expect(mockSendJSON).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'Settings' })
      );
    });

    // Clear the mock to track new calls
    mockSendJSON.mockClear();

    // Now call toggleMic - this should NOT send settings again
    await act(async () => {
      await ref.current.toggleMicrophone(true);
    });

    // Simulate another connection state change - this should NOT send settings again
    if (stateEventHandler) {
      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });
    }

    // Settings should NOT be sent again
    await waitFor(() => {
      expect(mockSendJSON).not.toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  test.skip('should handle multiple connection state changes without sending duplicate settings', async () => {
    const mockSendJSON = jest.fn();
    const mockAddEventListener = jest.fn();
    
    // Mock WebSocketManager
    WebSocketManager.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      sendJSON: mockSendJSON,
      addEventListener: mockAddEventListener,
      getState: jest.fn().mockReturnValue('connected')
    }));

    // Mock AudioManager
    AudioManager.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(jest.fn()),
      dispose: jest.fn(),
      setTtsMuted: jest.fn()
    }));

    render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        autoConnect={true}
      />
    );

    // Wait for initialization
    await waitFor(() => {
      expect(mockAddEventListener).toHaveBeenCalled();
    });

    // Simulate multiple connection state changes
    const stateEventHandler = mockAddEventListener.mock.calls.find(
      call => typeof call[0] === 'function'
    )?.[0];

    if (stateEventHandler) {
      // First connection
      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });

      // Wait for settings to be sent
      await waitFor(() => {
        expect(mockSendJSON).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'Settings' })
        );
      });

      // Clear the mock
      mockSendJSON.mockClear();

      // Simulate multiple additional connection events
      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });

      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });

      act(() => {
        stateEventHandler({ type: 'state', state: 'connected' });
      });

      // Settings should NOT be sent again
      await waitFor(() => {
        expect(mockSendJSON).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    }
  });
});
