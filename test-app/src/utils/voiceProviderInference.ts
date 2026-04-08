export type VoiceProviderId = 'openai' | 'deepgram';

/** Pick the choice matching the current proxy endpoint path, or null if ambiguous / direct. */
export function inferVoiceProviderId(
  connectionMode: 'direct' | 'proxy',
  proxyEndpoint: string
): VoiceProviderId | null {
  if (connectionMode !== 'proxy' || !proxyEndpoint.trim()) return null;
  const p = proxyEndpoint.toLowerCase();
  if (p.includes('/openai')) return 'openai';
  if (p.includes('deepgram')) return 'deepgram';
  return null;
}
