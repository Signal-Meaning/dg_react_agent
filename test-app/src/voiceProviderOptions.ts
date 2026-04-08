/**
 * Voice provider URLs for test-app proxy mode (OpenAI Realtime vs Deepgram Voice Agent).
 * Paths match packages/voice-agent-backend combined server defaults.
 */

import type { VoiceProviderId } from './utils/voiceProviderInference';

export type { VoiceProviderId } from './utils/voiceProviderInference';
export { inferVoiceProviderId } from './utils/voiceProviderInference';

export interface VoiceProviderChoice {
  id: VoiceProviderId;
  label: string;
  /** WebSocket URL for DeepgramVoiceInteraction proxyEndpoint */
  proxyEndpoint: string;
}

function defaultWsScheme(): 'ws' | 'wss' {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
}

/**
 * Build provider choices. Env overrides win; otherwise defaults to combined backend on 127.0.0.1:8080.
 */
export function buildVoiceProviderChoices(): VoiceProviderChoice[] {
  const scheme = defaultWsScheme();
  const host = (import.meta.env.VITE_PROXY_HOST as string | undefined)?.trim() || '127.0.0.1';
  const port = (import.meta.env.VITE_PROXY_PORT as string | undefined)?.trim() || '8080';
  const deepgramPath =
    (import.meta.env.VITE_DEEPGRAM_PROXY_PATH as string | undefined)?.trim() || '/deepgram-proxy';

  const openaiEnv = (import.meta.env.VITE_OPENAI_PROXY_ENDPOINT as string | undefined)?.trim();
  const deepgramEnv = (import.meta.env.VITE_DEEPGRAM_PROXY_ENDPOINT as string | undefined)?.trim();
  const generic = (import.meta.env.VITE_PROXY_ENDPOINT as string | undefined)?.trim();

  const openaiUrl =
    openaiEnv ||
    (generic?.includes('/openai') ? generic : `${scheme}://${host}:${port}/openai`);
  const deepgramUrl =
    deepgramEnv ||
    (generic && generic.toLowerCase().includes('deepgram') ? generic : `${scheme}://${host}:${port}${deepgramPath}`);

  return [
    { id: 'openai', label: 'OpenAI Realtime', proxyEndpoint: openaiUrl },
    { id: 'deepgram', label: 'Deepgram Voice Agent', proxyEndpoint: deepgramUrl },
  ];
}
