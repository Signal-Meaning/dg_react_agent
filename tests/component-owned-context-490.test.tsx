/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #490: Component-owned agent context for Settings (TDD – tests first).
 *
 * Refactor: Component builds and updates agent.context when sending Settings,
 * publishes it via callback for app persistence, and accepts restored context for reconnect.
 *
 * These tests define the desired behavior and must FAIL until the implementation is added.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle, AgentOptions } from '../src/types';
import {
  createMockWebSocketManager,
  createMockAudioManager,
  createMockAgentOptions,
  MOCK_API_KEY,
} from './fixtures/mocks';
import {
  resetTestState,
  setupComponentAndConnect,
  simulateConnectionClose,
  simulateConnection,
  waitForSettingsSent,
  waitForEventListener,
  simulateSettingsApplied,
} from './utils/component-test-helpers';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

const baseOptions = {
  ...createMockAgentOptions(),
  language: 'en' as const,
  listenModel: 'nova-2',
  thinkProviderType: 'open_ai' as const,
  thinkModel: 'gpt-4o-mini',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.',
};

const optionsWithoutContext: AgentOptions = { ...baseOptions, context: undefined };

const restoredContext = {
  messages: [
    { type: 'History' as const, role: 'user' as const, content: 'Restored user message.' },
    { type: 'History' as const, role: 'assistant' as const, content: 'Restored assistant reply.' },
  ],
};

describe('Issue #490: Component-owned agent context', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('onAgentOptionsUsedForSettings callback', () => {
    it('calls onAgentOptionsUsedForSettings with the options used when sending Settings', async () => {
      const optionsUsed: AgentOptions[] = [];
      const onAgentOptionsUsedForSettings = jest.fn((opts: AgentOptions) => {
        optionsUsed.push(opts);
      });

      const settingsSent: Array<{ type: string; agent?: { context?: unknown } }> = [];
      mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
        const m = msg as { type: string; agent?: { context?: unknown } };
        if (m?.type === 'Settings') {
          settingsSent.push({ type: m.type, agent: m.agent ? { context: m.agent.context } : undefined });
        }
        return true; // so component calls onAgentOptionsUsedForSettings after send
      });

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={optionsWithoutContext}
          onAgentOptionsUsedForSettings={onAgentOptionsUsedForSettings}
        />
      );
      await waitFor(() => expect(ref.current).toBeTruthy());

      await setupComponentAndConnect(ref, mockWebSocketManager);

      expect(settingsSent.length).toBeGreaterThanOrEqual(1);
      expect(onAgentOptionsUsedForSettings).toHaveBeenCalled();
      expect(optionsUsed.length).toBeGreaterThanOrEqual(1);
      const lastUsed = optionsUsed[optionsUsed.length - 1];
      expect(lastUsed).toBeDefined();
      expect(lastUsed.language).toBe(optionsWithoutContext.language);
      expect(lastUsed.instructions).toBe(optionsWithoutContext.instructions);
    });
  });

  describe('restoredAgentContext', () => {
    it('uses restoredAgentContext in Settings when in-memory history is empty', async () => {
      const settingsSent: Array<{ type: string; agent?: { context?: { messages?: unknown[] } } }> = [];
      mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
        const m = msg as { type: string; agent?: { context?: { messages?: unknown[] } } };
        if (m?.type === 'Settings') {
          settingsSent.push({
            type: m.type,
            agent: m.agent ? { context: m.agent.context } : undefined,
          });
        }
      });

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={optionsWithoutContext}
          restoredAgentContext={restoredContext}
        />
      );
      await waitFor(() => expect(ref.current).toBeTruthy());

      await setupComponentAndConnect(ref, mockWebSocketManager);

      expect(settingsSent.length).toBeGreaterThanOrEqual(1);
      const firstSettings = settingsSent[0];
      expect(firstSettings.agent?.context).toBeDefined();
      expect(firstSettings.agent?.context?.messages).toBeDefined();
      expect(Array.isArray(firstSettings.agent?.context?.messages)).toBe(true);
      expect(firstSettings.agent?.context?.messages?.length).toBe(2);
      const contents = (firstSettings.agent?.context?.messages ?? []).map(
        (m: { content?: string }) => m.content
      );
      expect(contents).toContain('Restored user message.');
      expect(contents).toContain('Restored assistant reply.');
    });

    it('uses restoredAgentContext on reconnect when in-memory history is empty', async () => {
      const settingsSent: Array<{ type: string; agent?: { context?: { messages?: unknown[] } } }> = [];
      mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
        const m = msg as { type: string; agent?: { context?: { messages?: unknown[] } } };
        if (m?.type === 'Settings') {
          settingsSent.push({
            type: m.type,
            agent: m.agent ? { context: m.agent.context } : undefined,
          });
        }
      });

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={optionsWithoutContext}
          restoredAgentContext={restoredContext}
        />
      );
      await waitFor(() => expect(ref.current).toBeTruthy());

      const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);
      const countAfterFirstConnect = settingsSent.length;

      await simulateConnectionClose(eventListener);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitFor(
        () => expect(settingsSent.length).toBeGreaterThanOrEqual(countAfterFirstConnect + 1),
        { timeout: 3000 }
      );

      const reconnectSettings = settingsSent[settingsSent.length - 1];
      expect(reconnectSettings.agent?.context).toBeDefined();
      expect(reconnectSettings.agent?.context?.messages?.length).toBe(2);
      const contents = (reconnectSettings.agent?.context?.messages ?? []).map(
        (m: { content?: string }) => m.content
      );
      expect(contents).toContain('Restored user message.');
      expect(contents).toContain('Restored assistant reply.');
    });
  });

  describe('component builds context from own conversation history', () => {
    it('builds agent.context from conversationHistoryRef when no getAgentOptions and no restoredContext', async () => {
      const settingsSent: Array<{ type: string; agent?: { context?: { messages?: unknown[] } } }> = [];
      mockWebSocketManager.sendJSON.mockImplementation((msg: unknown) => {
        const m = msg as { type: string; agent?: { context?: { messages?: unknown[] } } };
        if (m?.type === 'Settings') {
          settingsSent.push({
            type: m.type,
            agent: m.agent ? { context: m.agent.context } : undefined,
          });
        }
      });

      // conversationStorage so ConversationText updates conversationHistoryRef (component only appends when storage is set)
      const storage = new Map<string, string>();
      const conversationStorage = {
        getItem: (key: string) => Promise.resolve(storage.get(key) ?? null),
        setItem: (key: string, value: string) => {
          storage.set(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          storage.delete(key);
          return Promise.resolve();
        },
      };

      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={optionsWithoutContext}
          conversationStorage={conversationStorage}
          conversationStorageKey="test-490"
        />
      );
      await waitFor(() => expect(ref.current).toBeTruthy());

      await act(async () => {
        await ref.current?.start({ agent: true });
      });
      const eventListener = await waitForEventListener(mockWebSocketManager);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitForSettingsSent(mockWebSocketManager);

      // Simulate ConversationText (pass parsed object; handler expects object after manager parse)
      await act(async () => {
        eventListener({
          type: 'message',
          data: {
            type: 'ConversationText',
            role: 'user',
            content: 'What is the capital of France?',
          },
        });
      });
      await act(async () => {
        eventListener({
          type: 'message',
          data: {
            type: 'ConversationText',
            role: 'assistant',
            content: 'Paris.',
          },
        });
      });
      await simulateSettingsApplied(eventListener);

      // Disconnect and reconnect (no agentOptions.context, no getAgentOptions, no restoredAgentContext)
      await simulateConnectionClose(eventListener);
      await simulateConnection(eventListener, mockWebSocketManager);
      await waitFor(
        () => expect(settingsSent.length).toBeGreaterThanOrEqual(2),
        { timeout: 3000 }
      );

      const secondSettings = settingsSent[settingsSent.length - 1];
      expect(secondSettings.agent?.context).toBeDefined();
      expect(secondSettings.agent?.context?.messages).toBeDefined();
      const messages = secondSettings.agent?.context?.messages ?? [];
      expect(messages.length).toBeGreaterThanOrEqual(2);
      const contents = messages.map((m: { content?: string }) => m.content);
      expect(contents).toContain('What is the capital of France?');
      expect(contents).toContain('Paris.');
    });
  });
});
