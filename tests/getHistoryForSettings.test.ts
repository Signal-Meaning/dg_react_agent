/**
 * Unit tests for getHistoryForSettings (Phase 1 refactor – TDD)
 * Issue #489 / REFACTORING-PLAN-release-v0.9.8
 *
 * Contract: returns conversation history for building agent.context in Settings,
 * from in-memory → last persisted → sync storage (e.g. localStorage), with source for logging.
 */

import { getHistoryForSettings } from '../src/utils/getHistoryForSettings';
import type { ConversationMessage } from '../src/types';

const userMsg: ConversationMessage = { role: 'user', content: 'Hello', timestamp: 1 };
const assistantMsg: ConversationMessage = { role: 'assistant', content: 'Hi there', timestamp: 2 };

describe('getHistoryForSettings', () => {
  describe('precedence: in_memory → persisted → storage', () => {
    it('returns in-memory history when present', () => {
      const result = getHistoryForSettings({
        latestHistory: [userMsg, assistantMsg],
        lastPersistedHistory: [userMsg],
        storageKeys: ['dg_conversation'],
        getItem: () => null,
      });
      expect(result.history).toEqual([userMsg, assistantMsg]);
      expect(result.source).toBe('in_memory');
    });

    it('returns last persisted when in-memory is empty', () => {
      const result = getHistoryForSettings({
        latestHistory: [],
        lastPersistedHistory: [userMsg, assistantMsg],
        storageKeys: ['dg_conversation'],
        getItem: () => null,
      });
      expect(result.history).toEqual([userMsg, assistantMsg]);
      expect(result.source).toBe('persisted');
    });

    it('returns last persisted when latestHistory is undefined', () => {
      const result = getHistoryForSettings({
        latestHistory: undefined,
        lastPersistedHistory: [userMsg],
        storageKeys: ['dg_conversation'],
        getItem: () => null,
      });
      expect(result.history).toEqual([userMsg]);
      expect(result.source).toBe('persisted');
    });

    it('returns storage when in-memory and persisted are empty', () => {
      const stored = JSON.stringify([userMsg, assistantMsg]);
      const result = getHistoryForSettings({
        latestHistory: undefined,
        lastPersistedHistory: undefined,
        storageKeys: ['dg_voice_conversation', 'dg_conversation'],
        getItem: (key) => (key === 'dg_voice_conversation' ? stored : null),
      });
      expect(result.history).toEqual([userMsg, assistantMsg]);
      expect(result.source).toBe('storage');
    });

    it('tries keys in order and uses first non-empty valid parse', () => {
      const result = getHistoryForSettings({
        latestHistory: undefined,
        lastPersistedHistory: undefined,
        storageKeys: ['first', 'second', 'dg_conversation'],
        getItem: (key) => (key === 'second' ? JSON.stringify([userMsg]) : null),
      });
      expect(result.history).toEqual([userMsg]);
      expect(result.source).toBe('storage');
    });
  });

  describe('empty / no source', () => {
    it('returns empty history and undefined source when all sources empty', () => {
      const result = getHistoryForSettings({
        latestHistory: undefined,
        lastPersistedHistory: undefined,
        storageKeys: ['dg_conversation'],
        getItem: () => null,
      });
      expect(result.history).toEqual([]);
      expect(result.source).toBeUndefined();
    });

    it('treats empty array as empty (uses next source)', () => {
      const result = getHistoryForSettings({
        latestHistory: [],
        lastPersistedHistory: [userMsg],
        storageKeys: ['dg_conversation'],
        getItem: () => null,
      });
      expect(result.history).toEqual([userMsg]);
      expect(result.source).toBe('persisted');
    });
  });

  describe('storage parsing and validation', () => {
    it('filters invalid entries (only user/assistant with string content)', () => {
      const raw = [
        { role: 'user', content: 'ok' },
        { role: 'system', content: 'skip' },
        { role: 'assistant', content: 'yes' },
        { role: 'user' },
      ];
      const result = getHistoryForSettings({
        latestHistory: undefined,
        lastPersistedHistory: undefined,
        storageKeys: ['key'],
        getItem: () => JSON.stringify(raw),
      });
      expect(result.history).toHaveLength(2);
      expect(result.history[0]).toEqual({ role: 'user', content: 'ok' });
      expect(result.history[1]).toEqual({ role: 'assistant', content: 'yes' });
      expect(result.source).toBe('storage');
    });

    it('ignores invalid JSON in storage', () => {
      const result = getHistoryForSettings({
        latestHistory: undefined,
        lastPersistedHistory: undefined,
        storageKeys: ['key'],
        getItem: () => 'not json',
      });
      expect(result.history).toEqual([]);
      expect(result.source).toBeUndefined();
    });

    it('ignores non-array storage value', () => {
      const result = getHistoryForSettings({
        latestHistory: undefined,
        lastPersistedHistory: undefined,
        storageKeys: ['key'],
        getItem: () => JSON.stringify({ messages: [] }),
      });
      expect(result.history).toEqual([]);
      expect(result.source).toBeUndefined();
    });
  });
});
