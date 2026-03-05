/**
 * Unit tests for getContextForSettings (Issue #489 / test 9 isolation).
 *
 * The test-app builds agentOptions.context from conversationForDisplay with fallback to
 * component ref. These tests ensure the fallback returns context when display is empty
 * but ref has history, so Settings on reconnect include context.
 */

import { getContextForSettings } from '../../src/utils/context-for-settings';

describe('getContextForSettings', () => {
  test('returns undefined when both display and ref are empty', () => {
    const result = getContextForSettings([], () => []);
    expect(result).toBeUndefined();
  });

  test('returns context from conversationForDisplay when non-empty', () => {
    const display = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const result = getContextForSettings(display, () => []);
    expect(result).toBeDefined();
    expect(result!.messages).toHaveLength(2);
    expect(result!.messages[0]).toEqual({ type: 'History', role: 'user', content: 'Hello' });
    expect(result!.messages[1]).toEqual({ type: 'History', role: 'assistant', content: 'Hi there' });
  });

  test('returns context from ref when conversationForDisplay is empty (fallback for reconnect)', () => {
    const refHistory = [
      { role: 'assistant', content: 'Hello! How can I assist you today?' },
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: 'Paris.' },
    ];
    const result = getContextForSettings([], () => refHistory);
    expect(result).toBeDefined();
    expect(result!.messages).toHaveLength(3);
    expect(result!.messages[1].content).toBe('What is the capital of France?');
  });

  test('prefers conversationForDisplay over ref when both non-empty', () => {
    const display = [{ role: 'user', content: 'From display' }];
    const refHistory = [{ role: 'user', content: 'From ref' }];
    const result = getContextForSettings(display, () => refHistory);
    expect(result!.messages[0].content).toBe('From display');
  });

  test('returns undefined when getRefHistory returns undefined', () => {
    const result = getContextForSettings([], () => undefined as unknown as undefined);
    expect(result).toBeUndefined();
  });

  test('returns undefined when ref returns empty array and display is empty', () => {
    const result = getContextForSettings([], () => []);
    expect(result).toBeUndefined();
  });
});
