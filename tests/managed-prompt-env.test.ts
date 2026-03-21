/**
 * Unit tests for integration helper parseManagedPromptFromEnv (Issue #539 real-API env gate).
 * @jest-environment node
 */

import { parseManagedPromptFromEnv } from './integration/helpers/managed-prompt-env';

describe('parseManagedPromptFromEnv (Issue #539)', () => {
  const base: NodeJS.ProcessEnv = {};

  it('returns undefined when OPENAI_MANAGED_PROMPT_ID is unset', () => {
    expect(parseManagedPromptFromEnv({ ...base })).toBeUndefined();
  });

  it('returns undefined when OPENAI_MANAGED_PROMPT_ID is blank or whitespace', () => {
    expect(parseManagedPromptFromEnv({ ...base, OPENAI_MANAGED_PROMPT_ID: '   ' })).toBeUndefined();
    expect(parseManagedPromptFromEnv({ ...base, OPENAI_MANAGED_PROMPT_ID: '' })).toBeUndefined();
  });

  it('returns { id } when only id is set', () => {
    expect(parseManagedPromptFromEnv({ ...base, OPENAI_MANAGED_PROMPT_ID: 'pmpt_abc' })).toEqual({ id: 'pmpt_abc' });
  });

  it('trims id', () => {
    expect(parseManagedPromptFromEnv({ ...base, OPENAI_MANAGED_PROMPT_ID: '  pmpt_x  ' })).toEqual({ id: 'pmpt_x' });
  });

  it('includes version when set and non-empty after trim', () => {
    expect(
      parseManagedPromptFromEnv({
        ...base,
        OPENAI_MANAGED_PROMPT_ID: 'p1',
        OPENAI_MANAGED_PROMPT_VERSION: ' v2 ',
      })
    ).toEqual({ id: 'p1', version: 'v2' });
  });

  it('omits version when OPENAI_MANAGED_PROMPT_VERSION is blank', () => {
    expect(
      parseManagedPromptFromEnv({
        ...base,
        OPENAI_MANAGED_PROMPT_ID: 'p1',
        OPENAI_MANAGED_PROMPT_VERSION: '   ',
      })
    ).toEqual({ id: 'p1' });
  });

  it('parses OPENAI_MANAGED_PROMPT_VARIABLES as JSON object', () => {
    expect(
      parseManagedPromptFromEnv({
        ...base,
        OPENAI_MANAGED_PROMPT_ID: 'p1',
        OPENAI_MANAGED_PROMPT_VARIABLES: '{"topic":"weather"}',
      })
    ).toEqual({ id: 'p1', variables: { topic: 'weather' } });
  });

  it('throws when OPENAI_MANAGED_PROMPT_VARIABLES is invalid JSON', () => {
    expect(() =>
      parseManagedPromptFromEnv({
        ...base,
        OPENAI_MANAGED_PROMPT_ID: 'p1',
        OPENAI_MANAGED_PROMPT_VARIABLES: '{not json',
      })
    ).toThrow(/OPENAI_MANAGED_PROMPT_VARIABLES must be valid JSON/);
  });

  it('throws when OPENAI_MANAGED_PROMPT_VARIABLES is a JSON array', () => {
    expect(() =>
      parseManagedPromptFromEnv({
        ...base,
        OPENAI_MANAGED_PROMPT_ID: 'p1',
        OPENAI_MANAGED_PROMPT_VARIABLES: '[1,2]',
      })
    ).toThrow(/must be a JSON object/);
  });
});
