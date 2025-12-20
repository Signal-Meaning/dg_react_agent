/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Connection Mode Selection Tests - Issue #242
 * 
 * Tests for the logic that determines whether to use direct connection
 * or proxy mode based on props.
 * 
 * Test scenarios:
 * 1. Mode selection logic correctly identifies proxy mode
 * 2. Mode selection logic correctly identifies direct mode
 * 3. Mode selection handles edge cases (empty strings, undefined, etc.)
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { DeepgramVoiceInteractionProps, DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Connection Mode Selection Logic', () => {
  beforeEach(() => {
    resetTestState();
    jest.clearAllMocks();
    
    // Setup mocks
    WebSocketManager.mockImplementation(createMockWebSocketManager);
    AudioManager.mockImplementation(createMockAudioManager);
  });

  describe('Mode Detection', () => {
    it('should detect proxy mode when proxyEndpoint is provided', async () => {
      const props: DeepgramVoiceInteractionProps = {
        proxyEndpoint: 'wss://api.example.com/deepgram-proxy',
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(<DeepgramVoiceInteraction {...props} ref={ref} />);

      // Call start() to trigger manager creation
      await act(async () => {
        await ref.current?.start({ agent: true });
      });

      // Wait for managers to be created
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify that proxy endpoint was used (not Deepgram's direct endpoint)
      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        expect(options.url).toBe('wss://api.example.com/deepgram-proxy');
        expect(options.url).not.toContain('agent.deepgram.com');
      }
    });

    it('should detect direct mode when apiKey is provided', async () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: MOCK_API_KEY,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(<DeepgramVoiceInteraction {...props} ref={ref} />);

      // Call start() to trigger manager creation
      await act(async () => {
        await ref.current?.start({ agent: true });
      });

      // Wait for managers to be created
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify that Deepgram's direct endpoint was used
      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        expect(options.url).toContain('agent.deepgram.com');
        expect(options.apiKey).toBe(MOCK_API_KEY);
      }
    });

    it('should handle empty string proxyEndpoint as invalid', async () => {
      const props = {
        proxyEndpoint: '',
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      } as unknown as DeepgramVoiceInteractionProps;

      const onError = jest.fn();
      const propsWithErrorHandler = { ...props, onError } as DeepgramVoiceInteractionProps;

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(<DeepgramVoiceInteraction {...propsWithErrorHandler} ref={ref} />);

      // Try to start - this should trigger the error
      await act(async () => {
        try {
          await ref.current?.start({ agent: true });
        } catch (error) {
          // Expected to fail
        }
      });

      // Wait for error to be handled
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should call onError with configuration error
      expect(onError).toHaveBeenCalled();
    });

    it('should handle undefined proxyEndpoint correctly', async () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: MOCK_API_KEY,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(<DeepgramVoiceInteraction {...props} ref={ref} />);

      // Call start() to trigger manager creation
      await act(async () => {
        await ref.current?.start({ agent: true });
      });

      // Wait for managers to be created
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should use direct mode when proxyEndpoint is undefined
      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        expect(options.url).toContain('agent.deepgram.com');
      }
    });
  });

  describe('URL Construction', () => {
    it('should use proxy endpoint URL directly in proxy mode', async () => {
      const proxyEndpoint = 'wss://api.example.com/deepgram-proxy';
      const props: DeepgramVoiceInteractionProps = {
        proxyEndpoint,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(<DeepgramVoiceInteraction {...props} ref={ref} />);

      // Call start() to trigger manager creation
      await act(async () => {
        await ref.current?.start({ agent: true });
      });

      // Wait for managers to be created
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        // URL should be exactly the proxy endpoint, not modified
        expect(options.url).toBe(proxyEndpoint);
      }
    });

    it('should construct Deepgram URL correctly in direct mode', async () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: MOCK_API_KEY,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(<DeepgramVoiceInteraction {...props} ref={ref} />);

      // Call start() to trigger manager creation
      await act(async () => {
        await ref.current?.start({ agent: true });
      });

      // Wait for managers to be created
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        // Should use Deepgram's agent endpoint
        expect(options.url).toContain('agent.deepgram.com');
        expect(options.url).toContain('/v1/agent/converse');
      }
    });
  });
});
