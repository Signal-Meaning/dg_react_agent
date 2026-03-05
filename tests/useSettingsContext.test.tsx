/**
 * Unit tests for useSettingsContext hook (Phase 4 refactor – TDD)
 * Issue #489 / REFACTORING-PLAN-release-v0.9.8
 *
 * Contract: hook returns getEffectiveContext() that resolves context from
 * history → getAgentOptions → restored, for use in sendAgentSettings.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { useSettingsContext } from '../src/hooks/useSettingsContext';
import type { ConversationMessage } from '../src/types';

type HistoryItem = { type: 'History'; role: 'user' | 'assistant'; content: string };

const userMsg: ConversationMessage = { role: 'user', content: 'Hi', timestamp: 1 };
const assistantMsg: ConversationMessage = { role: 'assistant', content: 'Hello', timestamp: 2 };

function toContextMessages(history: ConversationMessage[]): HistoryItem[] {
  return history.map((m) => ({ type: 'History' as const, role: m.role, content: m.content }));
}

function TestHarness(props: {
  latestHistoryRef: React.MutableRefObject<ConversationMessage[]>;
  lastPersistedHistoryRef: React.MutableRefObject<ConversationMessage[]>;
  storageKeys: string[];
  getItem: (key: string) => string | null;
  getAgentOptions: (getter: () => ConversationMessage[]) => { context?: { messages: HistoryItem[] } } | undefined;
  agentOptionsRef: React.MutableRefObject<{ context?: { messages: HistoryItem[] } } | undefined>;
  restoredAgentContextRef: React.MutableRefObject<{ messages: HistoryItem[] } | undefined>;
}) {
  const { getEffectiveContext } = useSettingsContext({
    latestHistoryRef: props.latestHistoryRef,
    lastPersistedHistoryRef: props.lastPersistedHistoryRef,
    storageKeys: props.storageKeys,
    getItem: props.getItem,
    getAgentOptions: props.getAgentOptions,
    agentOptionsRef: props.agentOptionsRef,
    restoredAgentContextRef: props.restoredAgentContextRef,
  });
  return (
    <div>
      <button
        data-testid="get-context"
        onClick={() => {
          const ctx = getEffectiveContext();
          (window as unknown as { __lastContext: unknown }).__lastContext = ctx;
        }}
      />
    </div>
  );
}

describe('useSettingsContext', () => {
  it('returns getEffectiveContext function', () => {
    const latestRef = { current: [] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: undefined as { messages: HistoryItem[] } | undefined };
    const getAgentOptions = jest.fn(() => undefined);

    render(
      <TestHarness
        latestHistoryRef={latestRef}
        lastPersistedHistoryRef={persistedRef}
        storageKeys={[]}
        getItem={() => null}
        getAgentOptions={getAgentOptions}
        agentOptionsRef={agentOptionsRef}
        restoredAgentContextRef={restoredRef}
      />
    );
    expect(getAgentOptions).not.toHaveBeenCalled();
  });

  it('getEffectiveContext returns fromHistory when latest history has items', () => {
    const latestRef = { current: [userMsg, assistantMsg] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: undefined as { messages: HistoryItem[] } | undefined };
    const getAgentOptions = jest.fn(() => undefined);

    const { getByTestId } = render(
      <TestHarness
        latestHistoryRef={latestRef}
        lastPersistedHistoryRef={persistedRef}
        storageKeys={['dg_conversation']}
        getItem={() => null}
        getAgentOptions={getAgentOptions}
        agentOptionsRef={agentOptionsRef}
        restoredAgentContextRef={restoredRef}
      />
    );

    act(() => {
      getByTestId('get-context').click();
    });

    const ctx = (window as unknown as { __lastContext: { messages: HistoryItem[] } | undefined }).__lastContext;
    expect(ctx).toBeDefined();
    expect(ctx?.messages).toHaveLength(2);
    expect(ctx?.messages[0]).toEqual({ type: 'History', role: 'user', content: 'Hi' });
    expect(ctx?.messages[1]).toEqual({ type: 'History', role: 'assistant', content: 'Hello' });
  });

  it('getEffectiveContext returns fromApp when getAgentOptions returns context and history empty', () => {
    const appContext = { messages: toContextMessages([userMsg]) };
    const latestRef = { current: [] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: undefined as { messages: HistoryItem[] } | undefined };
    const getAgentOptions = jest.fn(() => ({ context: appContext }));

    const { getByTestId } = render(
      <TestHarness
        latestHistoryRef={latestRef}
        lastPersistedHistoryRef={persistedRef}
        storageKeys={[]}
        getItem={() => null}
        getAgentOptions={getAgentOptions}
        agentOptionsRef={agentOptionsRef}
        restoredAgentContextRef={restoredRef}
      />
    );

    act(() => {
      getByTestId('get-context').click();
    });

    const ctx = (window as unknown as { __lastContext: { messages: HistoryItem[] } | undefined }).__lastContext;
    expect(ctx).toEqual(appContext);
  });

  it('getEffectiveContext returns fromRestored when history and getAgentOptions are empty', () => {
    const restored = { messages: toContextMessages([assistantMsg]) };
    const latestRef = { current: [] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: restored };

    const { getByTestId } = render(
      <TestHarness
        latestHistoryRef={latestRef}
        lastPersistedHistoryRef={persistedRef}
        storageKeys={[]}
        getItem={() => null}
        getAgentOptions={() => undefined}
        agentOptionsRef={agentOptionsRef}
        restoredAgentContextRef={restoredRef}
      />
    );

    act(() => {
      getByTestId('get-context').click();
    });

    const ctx = (window as unknown as { __lastContext: { messages: HistoryItem[] } | undefined }).__lastContext;
    expect(ctx).toEqual(restored);
  });

  it('precedence: fromHistory over fromApp over fromRestored', () => {
    const latestRef = { current: [userMsg] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: { messages: toContextMessages([userMsg, assistantMsg]) } };
    const getAgentOptions = jest.fn(() => ({ context: { messages: toContextMessages([assistantMsg]) } }));

    const { getByTestId } = render(
      <TestHarness
        latestHistoryRef={latestRef}
        lastPersistedHistoryRef={persistedRef}
        storageKeys={[]}
        getItem={() => null}
        getAgentOptions={getAgentOptions}
        agentOptionsRef={agentOptionsRef}
        restoredAgentContextRef={restoredRef}
      />
    );

    act(() => {
      getByTestId('get-context').click();
    });

    const ctx = (window as unknown as { __lastContext: { messages: HistoryItem[] } | undefined }).__lastContext;
    expect(ctx?.messages).toHaveLength(1);
    expect(ctx?.messages[0].content).toBe('Hi');
  });
});
