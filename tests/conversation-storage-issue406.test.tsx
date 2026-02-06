/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Conversation storage (Issue #406) – TDD
 *
 * Component owns persistence logic; app provides storage via optional
 * conversationStorage interface. See docs/CONVERSATION-STORAGE.md.
 *
 * RED: These tests define the desired API and behavior. They fail until
 * the component accepts conversationStorage and implements getConversationHistory.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle, ConversationMessage } from '../src/types';
import {
  createMockWebSocketManager,
  createMockAudioManager,
  createMockAgentOptions,
  MOCK_API_KEY,
} from './fixtures/mocks';
import {
  resetTestState,
  setupComponentAndConnect,
  waitForEventListener,
  simulateConnection,
} from './utils/component-test-helpers';
import { act } from '@testing-library/react';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

/** Storage interface the app provides (docs/CONVERSATION-STORAGE.md) */
interface ConversationStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const DEFAULT_STORAGE_KEY = 'dg_conversation';

describe('Conversation storage (Issue #406)', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let mockStorage: ConversationStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    mockStorage = {
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn().mockResolvedValue(undefined),
    };
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('optional conversationStorage prop', () => {
    it('accepts optional conversationStorage and conversationStorageKey without error', () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      expect(() => {
        render(
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={createMockAgentOptions()}
            conversationStorage={mockStorage}
            conversationStorageKey="my-key"
          />
        );
      }).not.toThrow();
    });

    it('when conversationStorage is provided, calls getItem(key) on mount', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
        />
      );
      await waitFor(() => {
        expect(mockStorage.getItem).toHaveBeenCalledWith(DEFAULT_STORAGE_KEY);
      });
    });

    it('when conversationStorageKey is provided, calls getItem with that key', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          conversationStorageKey="custom-key"
        />
      );
      await waitFor(() => {
        expect(mockStorage.getItem).toHaveBeenCalledWith('custom-key');
      });
    });

    it('when conversationStorage is not provided, never calls getItem', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
        />
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(mockStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('getConversationHistory on ref', () => {
    it('ref exposes getConversationHistory() that returns an array', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
        />
      );
      await waitFor(() => {
        expect(mockStorage.getItem).toHaveBeenCalled();
      });
      expect(ref.current).toBeTruthy();
      expect(typeof ref.current!.getConversationHistory).toBe('function');
      const history = ref.current!.getConversationHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('when getItem resolves with valid JSON array, getConversationHistory returns restored messages', async () => {
      const restored: ConversationMessage[] = [
        { role: 'user', content: 'Hello', timestamp: 1000 },
        { role: 'assistant', content: 'Hi there', timestamp: 2000 },
      ];
      (mockStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(restored));

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
        />
      );
      await waitFor(() => {
        expect(mockStorage.getItem).toHaveBeenCalled();
      });
      const history = ref.current!.getConversationHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'Hello', timestamp: 1000 });
      expect(history[1]).toEqual({ role: 'assistant', content: 'Hi there', timestamp: 2000 });
    });
  });

  describe('persist on conversation update', () => {
    it('when conversation updates (e.g. ConversationText received), calls setItem(key, JSON.stringify(messages))', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
        />
      );
      await waitFor(() => {
        expect(mockStorage.getItem).toHaveBeenCalled();
      });

      // Start agent so the agent manager is created and addEventListener is called
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });

      // Simulate ConversationText arriving via the agent WebSocket (handleAgentMessage receives event.data)
      const addEventListenerCalls = mockWebSocketManager.addEventListener.mock.calls;
      const agentListener = addEventListenerCalls.length >= 2 ? addEventListenerCalls[addEventListenerCalls.length - 1][0] : addEventListenerCalls.find((c: unknown[]) => typeof c[0] === 'function')?.[0];
      const eventListener = agentListener as ((event: { data?: { type?: string; role?: string; content?: string } }) => void) | undefined;

      expect(eventListener).toBeDefined();
      await act(async () => {
        eventListener!({ type: 'message', data: { type: 'ConversationText', role: 'user', content: 'Test' } });
      });
      await waitFor(
        () => {
          expect(mockStorage.setItem).toHaveBeenCalledWith(
            DEFAULT_STORAGE_KEY,
            expect.stringContaining('"content":"Test"')
          );
        },
        { timeout: 2000 }
      );
    });
  });
});
