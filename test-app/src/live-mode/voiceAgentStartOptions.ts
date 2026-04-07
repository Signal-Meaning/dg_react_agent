/**
 * Maps proxy endpoint to `DeepgramVoiceInteractionHandle.start()` options for mic / Live flows.
 * Issue #561 policy / Issue #560 integration contract — keep in sync with TDD-PLAN §2.
 */
export function getVoiceAgentStartOptions(proxyEndpoint: string | undefined | null): {
  agent: true;
  transcription: boolean;
  userInitiated: true;
} {
  const useOpenAIProxy = (proxyEndpoint ?? '').includes('/openai');
  if (useOpenAIProxy) {
    return { agent: true, transcription: false, userInitiated: true };
  }
  return { agent: true, transcription: true, userInitiated: true };
}
