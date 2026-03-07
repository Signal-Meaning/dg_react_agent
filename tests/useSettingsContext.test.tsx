/**
 * Unit tests for useSettingsContext hook (Phase 4 refactor – TDD)
 * Issue #489 / REFACTORING-PLAN-release-v0.9.8
 *
 * Contract: hook returns getEffectiveContext() / getContextForSend() that resolve
 * context from history (refs + getHistoryForSettings) → getAgentOptions → restored,
 * for use in sendAgentSettings.
 *
 * Primary path: when latestHistoryRef (and optionally lastPersistedHistoryRef or
 * getItem) have data, getContextForSend() should return that as effectiveContext
 * so Settings on reconnect include context. getConversationHistory() in the component
 * returns state; getContextForSend() uses refs (and storage via getItem). If the
 * component remounts between a test reading getConversationHistory() and
 * sendAgentSettings running, the new instance has empty refs—so both "test sees 3"
 * and "getContextForSend sees 0" can be true (state vs ref, or old vs new instance).
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
  const { getEffectiveContext, getContextForSend } = useSettingsContext({
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
      <button
        data-testid="get-context-for-send"
        onClick={() => {
          const result = getContextForSend();
          (window as unknown as { __lastContextForSend: typeof result }).__lastContextForSend = result;
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

  /**
   * Primary path (Issue #489): when refs have history, getContextForSend returns
   * effectiveContext from getHistoryForSettings (fromHistory) so Settings on reconnect
   * include context. No fallback needed.
   */
  it('getContextForSend returns effectiveContext from refs (primary path) when latestHistoryRef has items', () => {
    const latestRef = { current: [userMsg, assistantMsg] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: undefined as { messages: HistoryItem[] } | undefined };
    const getAgentOptions = jest.fn(() => undefined);

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
      getByTestId('get-context-for-send').click();
    });

    const result = (window as unknown as { __lastContextForSend: { effectiveContext?: { messages: HistoryItem[] } } }).__lastContextForSend;
    expect(result.effectiveContext).toBeDefined();
    expect(result.effectiveContext?.messages).toHaveLength(2);
    expect(result.effectiveContext?.messages?.[0]).toEqual({ type: 'History', role: 'user', content: 'Hi' });
    expect(result.effectiveContext?.messages?.[1]).toEqual({ type: 'History', role: 'assistant', content: 'Hello' });
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

  /**
   * Retention path: when refs are empty but storage (getItem) has persisted messages,
   * getHistoryForSettings returns from storage and getContextForSend returns that as
   * effectiveContext. Validates that context retained in localStorage (or conversationStorage)
   * is used for Settings when in-memory refs are empty (e.g. after disconnect/remount).
   * See also: getHistoryForSettings.test.ts (returns from storage when refs empty),
   * conversation-storage-issue406.test.tsx (component setItem on update, getItem on mount).
   */
  it('getContextForSend returns effectiveContext from storage (getItem) when refs are empty', () => {
    const stored = JSON.stringify([userMsg, assistantMsg]);
    const latestRef = { current: [] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: undefined as { messages: HistoryItem[] } | undefined };
    const getAgentOptions = jest.fn(() => undefined);
    const getItem = jest.fn((key: string) => (key === 'dg_voice_conversation' ? stored : null));

    const { getByTestId } = render(
      <TestHarness
        latestHistoryRef={latestRef}
        lastPersistedHistoryRef={persistedRef}
        storageKeys={['dg_voice_conversation']}
        getItem={getItem}
        getAgentOptions={getAgentOptions}
        agentOptionsRef={agentOptionsRef}
        restoredAgentContextRef={restoredRef}
      />
    );

    act(() => {
      getByTestId('get-context-for-send').click();
    });

    const result = (window as unknown as { __lastContextForSend: { effectiveContext?: { messages: HistoryItem[] } } }).__lastContextForSend;
    expect(result.effectiveContext).toBeDefined();
    expect(result.effectiveContext?.messages).toHaveLength(2);
    expect(getItem).toHaveBeenCalledWith('dg_voice_conversation');
  });

  /**
   * Issue #489/9a: When history, getAgentOptions, and restoredRef are all empty (e.g. after disconnect
   * before reconnect), getContextForSend() must use window.__e2eRestoredAgentContext so Settings on
   * reconnect include context. Isolated unit test for the E2E fallback scenario.
   */
  it('getContextForSend returns effectiveContext from window.__e2eRestoredAgentContext when refs and getAgentOptions are empty', () => {
    const e2eRestored = { messages: toContextMessages([userMsg, assistantMsg]) };
    const latestRef = { current: [] as ConversationMessage[] };
    const persistedRef = { current: [] as ConversationMessage[] };
    const agentOptionsRef = { current: undefined as { context?: { messages: HistoryItem[] } } | undefined };
    const restoredRef = { current: undefined as { messages: HistoryItem[] } | undefined };
    const getAgentOptions = jest.fn(() => undefined);

    const win = window as Window & { __e2eRestoredAgentContext?: { messages: HistoryItem[] } };
    win.__e2eRestoredAgentContext = e2eRestored;

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
      getByTestId('get-context-for-send').click();
    });

    const result = (window as unknown as { __lastContextForSend: { effectiveContext?: { messages: HistoryItem[] } } }).__lastContextForSend;
    expect(result.effectiveContext).toBeDefined();
    expect(result.effectiveContext).toEqual(e2eRestored);
    expect(result.effectiveContext?.messages).toHaveLength(2);

    delete win.__e2eRestoredAgentContext;
  });
});
