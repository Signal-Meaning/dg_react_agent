/**
 * Unit tests for buildSettingsMessage (Phase 2 refactor – TDD)
 * Issue #489 / REFACTORING-PLAN-release-v0.9.8
 *
 * Contract: pure function that builds the Settings message object from
 * merged agent options (with context) and config (proxy flag, default idle).
 */

import { buildSettingsMessage } from '../src/utils/buildSettingsMessage';
import { DEFAULT_IDLE_TIMEOUT_MS } from '../src/constants/voice-agent';

describe('buildSettingsMessage', () => {
  const minimalOptions = {
    language: 'en',
    instructions: 'You are helpful.',
    voice: 'aura-asteria-en',
    thinkProviderType: 'open_ai' as const,
    thinkModel: 'gpt-4o-mini',
  };

  it('returns type Settings and correct audio encoding', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    expect(msg.type).toBe('Settings');
    expect(msg.audio.input).toEqual({ encoding: 'linear16', sample_rate: 16000 });
    expect(msg.audio.output).toEqual({ encoding: 'linear16', sample_rate: 24000 });
  });

  it('sets agent.language from options or defaults to en', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions, language: 'fr' },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    expect(msg.agent.language).toBe('fr');
  });

  it('includes idleTimeoutMs when isOpenAIProxy is true', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions, idleTimeoutMs: 5000 },
      { isOpenAIProxy: true, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    expect(msg.agent.idleTimeoutMs).toBe(5000);
  });

  it('uses defaultIdleTimeoutMs when isOpenAIProxy true and options.idleTimeoutMs undefined', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions },
      { isOpenAIProxy: true, defaultIdleTimeoutMs: 15000 }
    );
    expect(msg.agent.idleTimeoutMs).toBe(15000);
  });

  it('omits idleTimeoutMs when isOpenAIProxy is false', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions, idleTimeoutMs: 5000 },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    expect('idleTimeoutMs' in msg.agent).toBe(false);
  });

  it('sets agent.context from options.context', () => {
    const context = { messages: [{ type: 'History' as const, role: 'user' as const, content: 'Hi' }] };
    const msg = buildSettingsMessage(
      { ...minimalOptions, context },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    expect(msg.agent.context).toEqual(context);
  });

  it('omits greeting when context has messages (reconnection)', () => {
    const context = { messages: [{ type: 'History' as const, role: 'user' as const, content: 'Hi' }] };
    const msg = buildSettingsMessage(
      { ...minimalOptions, context, greeting: 'Hello!' },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    expect('greeting' in msg.agent).toBe(false);
  });

  it('includes greeting when context is empty/undefined', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions, greeting: 'Welcome!' },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    expect(msg.agent.greeting).toBe('Welcome!');
  });

  it('sets think provider and model from options', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions, thinkProviderType: 'open_ai', thinkModel: 'gpt-4o' },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    const think = msg.agent.think as { provider: { type: string; model: string }; prompt: string };
    expect(think.provider.type).toBe('open_ai');
    expect(think.provider.model).toBe('gpt-4o');
    expect(think.prompt).toBe(minimalOptions.instructions);
  });

  it('sets speak provider model from options.voice', () => {
    const msg = buildSettingsMessage(
      { ...minimalOptions, voice: 'aura-luna-en' },
      { isOpenAIProxy: false, defaultIdleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS }
    );
    const speak = msg.agent.speak as { provider: { type: string; model: string } };
    expect(speak.provider.model).toBe('aura-luna-en');
  });
});
