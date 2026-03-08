/**
 * useSettingsContext – Phase 4 refactor (Issue #489 / REFACTORING-PLAN-release-v0.9.8)
 *
 * Resolves effective agent.context for Settings from: history → getAgentOptions → restored.
 * Used by sendAgentSettings in the component.
 */

import { useCallback, type MutableRefObject } from 'react';
import { getHistoryForSettings } from '../utils/getHistoryForSettings';
import { getLogger } from '../utils/logger';
import type { ConversationMessage, AgentOptions } from '../types';

export type AgentContextMessage = { type: 'History'; role: 'user' | 'assistant'; content: string };
/** Effective context for Settings; compatible with AgentOptions.context */
export type AgentContext = AgentOptions['context'];

export interface UseSettingsContextParams {
  latestHistoryRef: MutableRefObject<ConversationMessage[] | undefined>;
  lastPersistedHistoryRef: MutableRefObject<ConversationMessage[] | undefined>;
  storageKeys: string[];
  getItem: (key: string) => string | null;
  getAgentOptions: (getter: () => ConversationMessage[]) => AgentOptions | undefined;
  agentOptionsRef: MutableRefObject<AgentOptions | undefined>;
  restoredAgentContextRef: MutableRefObject<AgentOptions['context'] | undefined>;
}

export interface SettingsContextResult {
  sourceForHistory: ConversationMessage[];
  effectiveContext: AgentContext | undefined;
  baseAgentOptions: AgentOptions | undefined;
}

export interface UseSettingsContextResult {
  getEffectiveContext: () => AgentContext | undefined;
  /** Returns sourceForHistory and effectiveContext in one pass (for sendAgentSettings: avoid calling getHistoryForSettings twice). */
  getContextForSend: () => SettingsContextResult;
}

/**
 * Returns getEffectiveContext() to resolve agent.context for Settings.
 * Precedence: fromHistory (getHistoryForSettings) → fromApp (getAgentOptions) → fromRestored → agentOptionsRef fallback.
 */
export function useSettingsContext(params: UseSettingsContextParams): UseSettingsContextResult {
  const {
    latestHistoryRef,
    lastPersistedHistoryRef,
    storageKeys,
    getItem,
    getAgentOptions,
    agentOptionsRef,
    restoredAgentContextRef,
  } = params;

  const getEffectiveContext = useCallback((): AgentContext | undefined => {
    const { history: sourceForHistoryArray } = getHistoryForSettings({
      latestHistory: latestHistoryRef.current,
      lastPersistedHistory: lastPersistedHistoryRef.current,
      storageKeys,
      getItem,
    });
    const sourceForHistory = sourceForHistoryArray.length > 0 ? sourceForHistoryArray : undefined;

    const fromHistory: AgentContext | undefined = sourceForHistory?.length
      ? {
          messages: sourceForHistory.map((m) => ({
            type: 'History' as const,
            role: m.role,
            content: m.content,
          })),
        }
      : undefined;

    const baseFromGetter = getAgentOptions(() => sourceForHistoryArray);
    const baseAgentOptions = baseFromGetter ?? agentOptionsRef.current;
    const fromApp =
      baseAgentOptions?.context?.messages?.length
        ? baseAgentOptions.context
        : agentOptionsRef.current?.context?.messages?.length
          ? agentOptionsRef.current.context
          : undefined;
    const fromRestored = restoredAgentContextRef.current?.messages?.length
      ? (restoredAgentContextRef.current as AgentContext)
      : undefined;

  return (fromHistory ?? fromApp ?? fromRestored) ?? undefined;
  }, [
    latestHistoryRef,
    lastPersistedHistoryRef,
    storageKeys,
    getItem,
    getAgentOptions,
    agentOptionsRef,
    restoredAgentContextRef,
  ]);

  const getContextForSend = useCallback((): SettingsContextResult => {
    const { history: sourceForHistoryArray } = getHistoryForSettings({
      latestHistory: latestHistoryRef.current,
      lastPersistedHistory: lastPersistedHistoryRef.current,
      storageKeys,
      getItem,
    });
    const sourceForHistory = sourceForHistoryArray.length > 0 ? sourceForHistoryArray : undefined;

    const fromHistory: AgentContext | undefined = sourceForHistory?.length
      ? {
          messages: sourceForHistory.map((m) => ({
            type: 'History' as const,
            role: m.role,
            content: m.content,
          })),
        }
      : undefined;

    const baseFromGetter = getAgentOptions(() => sourceForHistoryArray);
    const baseAgentOptions = baseFromGetter ?? agentOptionsRef.current;
    const fromApp =
      baseAgentOptions?.context?.messages?.length
        ? baseAgentOptions.context
        : agentOptionsRef.current?.context?.messages?.length
          ? agentOptionsRef.current.context
          : undefined;
    // Issue #489/9a: E2E test may set window.__e2eRestoredAgentContext or __appLastKnownConversation before reconnect; use when ref is empty.
    // Read from window and window.top so context is found when test sets on main frame but component runs in iframe.
    type WinWithE2E = Window & { __e2eRestoredAgentContext?: AgentContext; __appLastKnownConversation?: Array<{ role: string; content: string }> };
    const win: WinWithE2E | null = typeof window !== 'undefined' ? (window as WinWithE2E) : null;
    const topWin = win?.top && win.top !== win ? (win.top as WinWithE2E) : win;
    const fromWindowE2E = (win?.__e2eRestoredAgentContext ?? topWin?.__e2eRestoredAgentContext)?.messages?.length
      ? (win?.__e2eRestoredAgentContext ?? topWin?.__e2eRestoredAgentContext)
      : undefined;
    const fromWindowAppRaw = win?.__appLastKnownConversation ?? topWin?.__appLastKnownConversation;
    const fromWindowApp: AgentContext | undefined =
      Array.isArray(fromWindowAppRaw) && fromWindowAppRaw.length > 0
        ? { messages: fromWindowAppRaw.map((m) => ({ type: 'History' as const, role: m.role as 'user' | 'assistant', content: m.content })) }
        : undefined;
    const fromRestored =
      restoredAgentContextRef.current?.messages?.length
        ? restoredAgentContextRef.current
        : fromWindowE2E ?? fromWindowApp;

    if (fromRestored === fromWindowE2E && fromWindowE2E) {
      getLogger().debug('[9a getContextForSend] Using window.__e2eRestoredAgentContext fallback', {
        messageCount: fromWindowE2E.messages?.length,
      });
    }
    if (fromRestored === fromWindowApp && fromWindowApp) {
      getLogger().debug('[getContextForSend] Using window.__appLastKnownConversation fallback', {
        messageCount: fromWindowApp.messages?.length,
      });
    }

    const effectiveContext = (fromHistory ?? fromApp ?? (fromRestored as AgentContext | undefined)) ?? undefined;
    return { sourceForHistory: sourceForHistoryArray, effectiveContext, baseAgentOptions: baseAgentOptions ?? undefined };
  }, [
    latestHistoryRef,
    lastPersistedHistoryRef,
    storageKeys,
    getItem,
    getAgentOptions,
    agentOptionsRef,
    restoredAgentContextRef,
  ]);

  return { getEffectiveContext, getContextForSend };
}
