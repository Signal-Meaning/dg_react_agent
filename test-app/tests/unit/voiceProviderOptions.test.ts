import { inferVoiceProviderId } from '../../src/utils/voiceProviderInference';

describe('inferVoiceProviderId', () => {
  it('returns null in direct mode', () => {
    expect(inferVoiceProviderId('direct', 'ws://x/openai')).toBeNull();
  });

  it('returns openai when path includes /openai', () => {
    expect(inferVoiceProviderId('proxy', 'wss://voice-fixture.invalid/openai')).toBe('openai');
  });

  it('returns deepgram when URL includes deepgram', () => {
    expect(inferVoiceProviderId('proxy', 'wss://voice-fixture.invalid/deepgram-proxy')).toBe('deepgram');
  });

  it('returns null for unknown proxy path', () => {
    expect(inferVoiceProviderId('proxy', 'wss://voice-fixture.invalid/custom')).toBeNull();
  });
});
