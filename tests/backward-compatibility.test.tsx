/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Backward Compatibility Tests - Issue #242
 * 
 * Tests to verify that existing apiKey prop continues to work after
 * adding backend proxy support. This ensures we don't break existing
 * implementations.
 * 
 * Test scenarios:
 * 1. Existing apiKey prop still works (direct connection)
 * 2. All existing features work with apiKey prop
 * 3. Component behavior unchanged when using apiKey
 */

import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, DeepgramVoiceInteractionProps } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  MOCK_API_KEY,
  setupComponentAndConnect,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Backward Compatibility - apiKey Prop', () => {
  beforeEach(() => {
    resetTestState();
    jest.clearAllMocks();
    
    // Setup mocks
    WebSocketManager.mockImplementation(createMockWebSocketManager);
    AudioManager.mockImplementation(createMockAudioManager);
  });

  it('should still work with existing apiKey prop (direct connection)', () => {
    const props: DeepgramVoiceInteractionProps = {
      apiKey: MOCK_API_KEY,
      agentOptions: {
        language: 'en',
        listenModel: 'nova-3',
        instructions: 'Test instructions',
      },
    };

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(<DeepgramVoiceInteraction {...props} ref={ref} />);

    // Verify WebSocketManager was called with apiKey
    expect(WebSocketManager).toHaveBeenCalled();
    
    const agentManagerCall = WebSocketManager.mock.calls.find(
      (call: unknown[]) => {
        const options = call[0];
        return options?.service === 'agent';
      }
    );

    expect(agentManagerCall).toBeDefined();
    if (agentManagerCall) {
      const options = agentManagerCall[0];
      // Should use Deepgram's direct endpoint
      expect(options.url).toContain('agent.deepgram.com');
      // API key should be included
      expect(options.apiKey).toBe(MOCK_API_KEY);
    }
  });

  it('should maintain all existing behavior with apiKey prop', async () => {
    const props: DeepgramVoiceInteractionProps = {
      apiKey: MOCK_API_KEY,
      agentOptions: {
        language: 'en',
        listenModel: 'nova-3',
        instructions: 'Test instructions',
      },
      onReady: jest.fn(),
      onConnectionStateChange: jest.fn(),
      onAgentStateChange: jest.fn(),
    };

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    const { container } = render(<DeepgramVoiceInteraction {...props} ref={ref} />);

    // Component should render without errors
    expect(container).toBeTruthy();

    // Wait for component to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify component methods are available
    expect(ref.current).toBeTruthy();
    expect(typeof ref.current?.startAudioCapture).toBe('function');
    expect(typeof ref.current?.stopAudioCapture).toBe('function');
    expect(typeof ref.current?.sendTextMessage).toBe('function');
  });

  it('should connect to Deepgram directly when using apiKey', () => {
    const props: DeepgramVoiceInteractionProps = {
      apiKey: MOCK_API_KEY,
      agentOptions: {
        language: 'en',
        listenModel: 'nova-3',
      },
    };

    render(<DeepgramVoiceInteraction {...props} />);

    // Verify connection is made to Deepgram, not a proxy
    const agentManagerCall = WebSocketManager.mock.calls.find(
      (call: unknown[]) => {
        const options = call[0];
        return options?.service === 'agent';
      }
    );

    expect(agentManagerCall).toBeDefined();
    if (agentManagerCall) {
      const options = agentManagerCall[0];
      // Should NOT be a proxy endpoint
      expect(options.url).not.toContain('example.com');
      expect(options.url).not.toContain('proxy');
      // Should be Deepgram's endpoint
      expect(options.url).toContain('agent.deepgram.com');
    }
  });

  it('should handle apiKey prop exactly as before (no breaking changes)', () => {
    // This test ensures that the component's behavior with apiKey
    // is identical to how it worked before proxy support was added
    
    const props: DeepgramVoiceInteractionProps = {
      apiKey: MOCK_API_KEY,
      transcriptionOptions: {
        language: 'en',
        model: 'nova-2',
      },
      agentOptions: {
        language: 'en',
        listenModel: 'nova-3',
      },
    };

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    render(<DeepgramVoiceInteraction {...props} ref={ref} />);

    // Should create both transcription and agent managers
    const transcriptionCalls = WebSocketManager.mock.calls.filter(
      (call: unknown[]) => {
        const options = call[0];
        return options?.service === 'transcription';
      }
    );

    const agentCalls = WebSocketManager.mock.calls.filter(
      (call: unknown[]) => {
        const options = call[0];
        return options?.service === 'agent';
      }
    );

    // Both services should be initialized
    expect(transcriptionCalls.length).toBeGreaterThan(0);
    expect(agentCalls.length).toBeGreaterThan(0);

    // Both should use apiKey
    transcriptionCalls.forEach((call: unknown[]) => {
      const options = call[0];
      expect(options.apiKey).toBe(MOCK_API_KEY);
    });

    agentCalls.forEach((call: unknown[]) => {
      const options = call[0];
      expect(options.apiKey).toBe(MOCK_API_KEY);
    });
  });
});
