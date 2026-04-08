/**
 * Issue #414: Do not show session greeting as the "Agent Response" to a user message (e.g. after reload).
 * Issue #560: Lock the predicate so debug UI behavior stays explicit when comparing real mic vs E2E paths.
 */
import {
  shouldSuppressAgentResponseForGreetingAfterUser,
} from '../../src/utils/agentUtteranceGreetingPolicy';

const GREETING = 'Hello! How can I assist you today?';

describe('shouldSuppressAgentResponseForGreetingAfterUser', () => {
  it('returns true when utterance is the greeting and the penultimate history entry is user', () => {
    expect(
      shouldSuppressAgentResponseForGreetingAfterUser({
        utteranceText: GREETING,
        greetingText: GREETING,
        history: [
          { role: 'user', content: 'What time is it?' },
          { role: 'assistant', content: GREETING },
        ],
      })
    ).toBe(true);
  });

  it('returns false on first-turn greeting (no prior user in the checked position)', () => {
    expect(
      shouldSuppressAgentResponseForGreetingAfterUser({
        utteranceText: GREETING,
        greetingText: GREETING,
        history: [{ role: 'assistant', content: GREETING }],
      })
    ).toBe(false);
  });

  it('returns false when utterance is not the greeting even if penultimate entry is user', () => {
    expect(
      shouldSuppressAgentResponseForGreetingAfterUser({
        utteranceText: 'It is 3pm.',
        greetingText: GREETING,
        history: [
          { role: 'user', content: 'What time is it?' },
          { role: 'assistant', content: 'It is 3pm.' },
        ],
      })
    ).toBe(false);
  });

  it('returns false for empty history', () => {
    expect(
      shouldSuppressAgentResponseForGreetingAfterUser({
        utteranceText: GREETING,
        greetingText: GREETING,
        history: [],
      })
    ).toBe(false);
  });

  it('ignores surrounding whitespace when comparing greeting', () => {
    expect(
      shouldSuppressAgentResponseForGreetingAfterUser({
        utteranceText: `  ${GREETING}  `,
        greetingText: GREETING,
        history: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: GREETING },
        ],
      })
    ).toBe(true);
  });
});
