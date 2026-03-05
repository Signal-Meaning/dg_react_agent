/**
 * Pure helper for building agentOptions.context for session retention on reconnect (Issue #489).
 * Prefer conversationForDisplay; fallback to ref history so Settings include context when the
 * component has history even if app state (conversationForDisplay) hasn't been updated yet.
 */

export type ContextMessage = { type: 'History'; role: string; content: string };
export type HistoryItem = { role: string; content: string };

/**
 * Returns context.messages for Settings, or undefined if no history.
 * Used by App.tsx so unit tests can assert the fallback behavior without the component.
 */
export function getContextForSettings(
  conversationForDisplay: HistoryItem[],
  getRefHistory: () => HistoryItem[] | undefined
): { messages: ContextMessage[] } | undefined {
  const fromDisplay = conversationForDisplay;
  const fromRef = getRefHistory() ?? [];
  const history = fromDisplay.length > 0 ? fromDisplay : fromRef;
  if (history.length === 0) return undefined;
  return {
    messages: history.map((m) => ({ type: 'History' as const, role: m.role, content: m.content })),
  };
}
