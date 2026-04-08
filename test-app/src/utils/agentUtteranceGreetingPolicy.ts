/**
 * Issue #414: When a new session replays the greeting after a user message already exists in history,
 * the test-app must not treat that greeting as the assistant's answer to the user in the standalone
 * "Agent Response" readout (misleading UX). Conversation history still reflects the server state.
 *
 * @see App.tsx handleAgentUtterance
 */
export function shouldSuppressAgentResponseForGreetingAfterUser(params: {
  utteranceText: string;
  greetingText: string;
  history: ReadonlyArray<{ role: string; content: string; timestamp?: number }>;
}): boolean {
  const isGreeting = params.utteranceText.trim() === params.greetingText.trim();
  const prevEntry =
    params.history.length >= 2 ? params.history[params.history.length - 2] : undefined;
  return isGreeting && prevEntry?.role === 'user';
}
