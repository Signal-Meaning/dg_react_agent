/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Backend Proxy Mode Tests - Issue #242
 * 
 * Tests for component prop handling and connection mode selection when using
 * backend proxy mode instead of direct API key connection.
 * 
 * Test scenarios:
 * 1. Component should use proxy endpoint when proxyEndpoint prop is provided
 * 2. Component should use direct connection when apiKey prop is provided (backward compatibility)
 * 3. Component should throw error when neither apiKey nor proxyEndpoint provided
 * 4. Component should prioritize proxyEndpoint over apiKey when both provided
 */

import React from 'react';
import { render } from '@testing-library/react';
import { DeepgramVoiceInteractionProps } from '../src/types';
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

describe('Backend Proxy Mode', () => {
  beforeEach(() => {
    resetTestState();
    jest.clearAllMocks();
    
    // Setup mocks
    WebSocketManager.mockImplementation(createMockWebSocketManager);
    AudioManager.mockImplementation(createMockAudioManager);
  });

  describe('Connection Mode Selection', () => {
    it('should use proxy endpoint when proxyEndpoint prop is provided', () => {
      const proxyEndpoint = 'wss://api.example.com/deepgram-proxy';
      const props: DeepgramVoiceInteractionProps = {
        proxyEndpoint,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      const { container } = render(<DeepgramVoiceInteraction {...props} />);

      // Verify WebSocketManager was called with proxy endpoint
      expect(WebSocketManager).toHaveBeenCalled();
      
      // Get the last call to WebSocketManager (for agent connection)
      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        // In proxy mode, URL should be the proxy endpoint, not Deepgram's URL
        expect(options.url).toBe(proxyEndpoint);
        // API key should NOT be included in proxy mode
        expect(options.apiKey).toBeUndefined();
      }
    });

    it('should use direct connection when apiKey prop is provided', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: MOCK_API_KEY,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      render(<DeepgramVoiceInteraction {...props} />);

      // Verify WebSocketManager was called
      expect(WebSocketManager).toHaveBeenCalled();
      
      // Get the agent manager call
      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        // In direct mode, URL should be Deepgram's agent endpoint
        expect(options.url).toContain('agent.deepgram.com');
        // API key should be included
        expect(options.apiKey).toBe(MOCK_API_KEY);
      }
    });

    it('should throw error when neither apiKey nor proxyEndpoint provided', () => {
      const props = {
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      } as unknown as DeepgramVoiceInteractionProps;

      // Component should throw or show error when neither prop is provided
      expect(() => {
        render(<DeepgramVoiceInteraction {...props} />);
      }).toThrow();
    });

    it('should prioritize proxyEndpoint over apiKey when both provided', () => {
      const proxyEndpoint = 'wss://api.example.com/deepgram-proxy';
      const props: DeepgramVoiceInteractionProps = {
        apiKey: MOCK_API_KEY,
        proxyEndpoint,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      render(<DeepgramVoiceInteraction {...props} />);

      // Verify WebSocketManager was called
      expect(WebSocketManager).toHaveBeenCalled();
      
      // Get the agent manager call
      const agentManagerCall = WebSocketManager.mock.calls.find(
        (call: unknown[]) => {
          const options = call[0];
          return options?.service === 'agent';
        }
      );

      expect(agentManagerCall).toBeDefined();
      if (agentManagerCall) {
        const options = agentManagerCall[0];
        // Should use proxy endpoint, not direct connection
        expect(options.url).toBe(proxyEndpoint);
        // API key should NOT be included when using proxy
        expect(options.apiKey).toBeUndefined();
      }
    });
  });

  describe('Authentication Support', () => {
    it('should support authentication token when provided with proxyEndpoint', () => {
      const proxyEndpoint = 'wss://api.example.com/deepgram-proxy';
      const authToken = 'jwt-token-here';
      const props: DeepgramVoiceInteractionProps = {
        proxyEndpoint,
        proxyAuthToken: authToken,
        agentOptions: {
          language: 'en',
          listenModel: 'nova-3',
        },
      };

      render(<DeepgramVoiceInteraction {...props} />);

      // Verify WebSocketManager was called with auth token
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
        // Auth token should be included in connection options
        expect(options.authToken).toBe(authToken);
      }
    });
  });
});
