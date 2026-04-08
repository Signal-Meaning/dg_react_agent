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
  waitForSettingsSent,
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

  /**
   * TDD all-messages-in-history (Issue #489, TDD-PLAN-ALL-MESSAGES-IN-HISTORY).
   * Every ConversationText (user or assistant) must be appended to history and passed to the app callback.
   */
  describe('all messages in history (Issue #489)', () => {
    it('when component receives sequence ConversationText (user, assistant, user, assistant), getConversationHistory and callbacks have all four in order', async () => {
      const onAgentUtterance = jest.fn<(_u: unknown, history?: ConversationMessage[]) => void>();
      const onUserMessage = jest.fn<(_m: unknown, history?: ConversationMessage[]) => void>();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          onAgentUtterance={onAgentUtterance as any}
          onUserMessage={onUserMessage as any}
        />
      );
      await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      const events: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: 'U1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'U2' },
        { role: 'assistant', content: 'A2' },
      ];
      for (const ev of events) {
        await act(async () => {
          eventListener({ type: 'message', data: { type: 'ConversationText', role: ev.role, content: ev.content } });
        });
      }

      await waitFor(
        () => {
          const history = ref.current!.getConversationHistory();
          expect(history).toHaveLength(4);
        },
        { timeout: 2000 }
      );

      const history = ref.current!.getConversationHistory();
      expect(history).toHaveLength(4);
      expect(history[0]).toMatchObject({ role: 'user', content: 'U1' });
      expect(history[1]).toMatchObject({ role: 'assistant', content: 'A1' });
      expect(history[2]).toMatchObject({ role: 'user', content: 'U2' });
      expect(history[3]).toMatchObject({ role: 'assistant', content: 'A2' });
    });

    it('OpenAI proxy: final Transcript on agent socket appends user to history and calls onUserMessage (Issue #560)', async () => {
      const onUserMessage = jest.fn();
      const onTranscriptUpdate = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          proxyEndpoint="ws://localhost:8080/openai"
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          onUserMessage={onUserMessage as any}
          onTranscriptUpdate={onTranscriptUpdate as any}
        />
      );
      await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      // Literal matches the simulated proxy `Transcript` payload — asserts history uses the transcript field as user content.
      const simulatedSttText = 'hello from voice';
      await act(async () => {
        eventListener({
          type: 'message',
          data: {
            type: 'Transcript',
            transcript: simulatedSttText,
            is_final: true,
            speech_final: true,
            channel: 0,
            channel_index: [] as number[],
            start: 0,
            duration: 0.5,
            alternatives: [{ transcript: simulatedSttText, confidence: 1, words: [] as unknown[] }],
          },
        });
      });

      await waitFor(() => {
        const h = ref.current!.getConversationHistory();
        expect(h.some((m) => m.role === 'user' && m.content === simulatedSttText)).toBe(true);
      });
      expect(onTranscriptUpdate).toHaveBeenCalled();
      expect(onUserMessage).toHaveBeenCalled();
    });

    it('OpenAI proxy: interim Transcript does not append user to conversation history', async () => {
      const onUserMessage = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          proxyEndpoint="ws://localhost:8080/openai"
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          onUserMessage={onUserMessage as any}
        />
      );
      await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      await act(async () => {
        eventListener({
          type: 'message',
          data: {
            type: 'Transcript',
            transcript: 'partial',
            is_final: false,
            speech_final: false,
            channel: 0,
            channel_index: [] as number[],
            start: 0,
            duration: 0,
            alternatives: [{ transcript: 'partial', confidence: 1, words: [] as unknown[] }],
          },
        });
      });

      expect(ref.current!.getConversationHistory()).toHaveLength(0);
      expect(onUserMessage).not.toHaveBeenCalled();
    });

    it('direct mode: is_final without speech_final does not append user (per-word Deepgram final)', async () => {
      const onUserMessage = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          onUserMessage={onUserMessage as any}
        />
      );
      await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      await act(async () => {
        eventListener({
          type: 'message',
          data: {
            type: 'Transcript',
            transcript: 'partial-word',
            is_final: true,
            speech_final: false,
            channel: 0,
            channel_index: [] as number[],
            start: 0,
            duration: 0.1,
            alternatives: [{ transcript: 'partial-word', confidence: 1, words: [] as unknown[] }],
          },
        });
      });

      expect(ref.current!.getConversationHistory()).toHaveLength(0);
      expect(onUserMessage).not.toHaveBeenCalled();
    });

    it('direct mode: speech_final appends full user turn to history', async () => {
      const onUserMessage = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          onUserMessage={onUserMessage as any}
        />
      );
      await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      await act(async () => {
        eventListener({
          type: 'message',
          data: {
            type: 'Transcript',
            transcript: 'full utterance',
            is_final: true,
            speech_final: true,
            channel: 0,
            channel_index: [] as number[],
            start: 0,
            duration: 0.5,
            alternatives: [{ transcript: 'full utterance', confidence: 1, words: [] as unknown[] }],
          },
        });
      });

      await waitFor(() => {
        expect(ref.current!.getConversationHistory()).toEqual(
          expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'full utterance' })])
        );
      });
      expect(onUserMessage).toHaveBeenCalled();
    });

    it('OpenAI proxy: is_final without speech_final still appends user (Realtime segment)', async () => {
      const onUserMessage = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          proxyEndpoint="ws://localhost:8080/openai"
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          onUserMessage={onUserMessage as any}
        />
      );
      await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      await act(async () => {
        eventListener({
          type: 'message',
          data: {
            type: 'Transcript',
            transcript: 'segment only is_final',
            is_final: true,
            speech_final: false,
            channel: 0,
            channel_index: [] as number[],
            start: 0,
            duration: 0.2,
            alternatives: [{ transcript: 'segment only is_final', confidence: 1, words: [] as unknown[] }],
          },
        });
      });

      await waitFor(() => {
        expect(ref.current!.getConversationHistory()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'segment only is_final' }),
          ])
        );
      });
      expect(onUserMessage).toHaveBeenCalled();
    });

    it('getConversationHistory includes new assistant message in the same act before React state flush (Issue #560)', async () => {
      const onAgentUtterance = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={createMockAgentOptions()}
          conversationStorage={mockStorage}
          onAgentUtterance={onAgentUtterance as any}
        />
      );
      await waitFor(() => expect(mockStorage.getItem).toHaveBeenCalled());
      await act(async () => {
        await ref.current!.start({ agent: true, transcription: false });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      await act(async () => {
        eventListener({
          type: 'message',
          data: { type: 'ConversationText', role: 'assistant', content: 'Same-tick' },
        });
        const h = ref.current!.getConversationHistory();
        expect(h).toHaveLength(1);
        expect(h[0]).toMatchObject({ role: 'assistant', content: 'Same-tick' });
        expect(onAgentUtterance).toHaveBeenCalled();
      });
    });
  });
});
