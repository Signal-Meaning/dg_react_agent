/**
 * History-for-Settings helper (Phase 1 refactor – Issue #489 / REFACTORING-PLAN-release-v0.9.8)
 *
 * Single pipeline for "what history do we use when building agent.context for Settings?"
 * Precedence: in_memory → persisted → sync storage (e.g. localStorage).
 */

import type { ConversationMessage } from '../types';

export type HistoryForSettingsSource = 'in_memory' | 'persisted' | 'storage';

export interface GetHistoryForSettingsParams {
  /** Latest in-memory conversation (e.g. from ref updated each render). */
  latestHistory: ConversationMessage[] | undefined;
  /** Last persisted history (e.g. module-level or from persist effect). */
  lastPersistedHistory: ConversationMessage[] | undefined;
  /** Storage keys to try in order (e.g. lastUsedKey, 'dg_voice_conversation', 'dg_conversation'). */
  storageKeys: string[];
  /** Sync getter for storage (e.g. localStorage.getItem). Test-friendly. */
  getItem: (key: string) => string | null;
}

export interface GetHistoryForSettingsResult {
  history: ConversationMessage[];
  source?: HistoryForSettingsSource;
}

function isValidMessage(m: unknown): m is ConversationMessage {
  if (!m || typeof m !== 'object') return false;
  const o = m as Record<string, unknown>;
  return (
    (o.role === 'user' || o.role === 'assistant') &&
    typeof o.content === 'string'
  );
}

function parseStorageValue(raw: string): ConversationMessage[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return parsed
      .filter(isValidMessage)
      .map((m) => ({
        role: m.role as ConversationMessage['role'],
        content: m.content,
        timestamp: (m as ConversationMessage).timestamp,
      }));
  } catch {
    return [];
  }
}

/**
 * Returns conversation history to use when building agent.context for Settings.
 * Precedence: latestHistory (if non-empty) → lastPersistedHistory → first valid storage key.
 */
export function getHistoryForSettings(
  params: GetHistoryForSettingsParams
): GetHistoryForSettingsResult {
  const { latestHistory, lastPersistedHistory, storageKeys, getItem } = params;

  if (latestHistory?.length) {
    return { history: latestHistory, source: 'in_memory' };
  }
  if (lastPersistedHistory?.length) {
    return { history: lastPersistedHistory, source: 'persisted' };
  }
  for (const key of storageKeys) {
    const raw = getItem(key);
    if (raw) {
      const history = parseStorageValue(raw);
      if (history.length > 0) {
        return { history, source: 'storage' };
      }
    }
  }
  return { history: [], source: undefined };
}
