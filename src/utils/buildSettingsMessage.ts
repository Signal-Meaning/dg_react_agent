/**
 * Build Settings message payload (Phase 2 refactor – Issue #489 / REFACTORING-PLAN-release-v0.9.8)
 *
 * Pure function: options (with context) + config → Settings message object.
 * No side effects; used by sendAgentSettings in the component.
 */

import type {
  AgentFunction,
  SessionAudioOutputSettings,
  ThinkManagedPrompt,
  ThinkOutputModality,
  ThinkToolChoice,
} from '../types/agent';
import { filterFunctionsForSettings } from './function-utils';

export interface BuildSettingsMessageOptions {
  language?: string;
  instructions?: string;
  voice?: string;
  thinkProviderType?: string;
  thinkModel?: string;
  thinkEndpointUrl?: string;
  thinkApiKey?: string;
  /**
   * Passed to Settings `agent.think.provider.temperature` for component/UI parity (Issue #538).
   * Not forwarded on OpenAI WebSocket `session.update` — see `REALTIME-SESSION-UPDATE-FIELD-MAP.md`.
   */
  thinkTemperature?: number;
  /** Passed to Settings agent.think.toolChoice → Realtime session.tool_choice (Issue #535). */
  thinkToolChoice?: ThinkToolChoice;
  /** Passed to Settings agent.think.outputModalities → Realtime session.output_modalities (Issue #536). */
  thinkOutputModalities?: ThinkOutputModality[];
  /** Passed to Settings agent.think.maxOutputTokens → Realtime session.max_output_tokens (Issue #537). */
  thinkMaxOutputTokens?: number;
  /** Passed to Settings agent.think.managedPrompt → Realtime session.prompt (Issue #539). */
  thinkManagedPrompt?: ThinkManagedPrompt;
  /** OpenAI proxy: Settings agent.sessionAudioOutput → Realtime session.audio.output (Issue #540). */
  sessionAudioOutput?: SessionAudioOutputSettings;
  functions?: AgentFunction[];
  listenModel?: string;
  greeting?: string;
  idleTimeoutMs?: number;
  /** Effective context (component-owned); when set with messages, greeting is omitted. */
  context?: { messages: Array<{ type: string; role: string; content: string }> };
}

export interface BuildSettingsMessageConfig {
  isOpenAIProxy: boolean;
  defaultIdleTimeoutMs: number;
}

export interface SettingsMessagePayload {
  type: 'Settings';
  audio: {
    input: { encoding: string; sample_rate: number };
    output: { encoding: string; sample_rate: number };
  };
  agent: {
    think: {
      provider: { type: string; model: string; temperature?: number };
      prompt?: string;
      toolChoice?: ThinkToolChoice;
      outputModalities?: ThinkOutputModality[];
      maxOutputTokens?: number;
      managedPrompt?: ThinkManagedPrompt;
      endpoint?: unknown;
      functions?: AgentFunction[];
    };
    speak: { provider: { type: string; model: string } };
    sessionAudioOutput?: SessionAudioOutputSettings;
    [key: string]: unknown;
  };
}

/**
 * Build the Settings message object for the Voice Agent protocol.
 */
export function buildSettingsMessage(
  options: BuildSettingsMessageOptions,
  config: BuildSettingsMessageConfig
): SettingsMessagePayload {
  const { isOpenAIProxy, defaultIdleTimeoutMs } = config;
  const effectiveContext = options.context;
  const hasContextMessages = (effectiveContext?.messages?.length ?? 0) > 0;
  const managedPrompt = pickThinkManagedPromptForSettings(options.thinkManagedPrompt);

  return {
    type: 'Settings',
    audio: {
      input: { encoding: 'linear16', sample_rate: 16000 },
      output: { encoding: 'linear16', sample_rate: 24000 },
    },
    agent: {
      ...(isOpenAIProxy ? { idleTimeoutMs: options.idleTimeoutMs ?? defaultIdleTimeoutMs } : {}),
      ...(isOpenAIProxy && options.sessionAudioOutput !== undefined && options.sessionAudioOutput !== null
        ? { sessionAudioOutput: options.sessionAudioOutput }
        : {}),
      language: options.language || 'en',
      ...(options.listenModel
        ? {
            listen: {
              provider: { type: 'deepgram', model: options.listenModel },
            },
          }
        : {}),
      think: {
        provider: {
          type: options.thinkProviderType || 'open_ai',
          model: options.thinkModel || 'gpt-4o-mini',
          ...(typeof options.thinkTemperature === 'number' && !Number.isNaN(options.thinkTemperature)
            ? { temperature: options.thinkTemperature }
            : {}),
        },
        prompt: options.instructions || 'You are a helpful voice assistant.',
        ...(options.thinkEndpointUrl && options.thinkApiKey
          ? {
              endpoint: {
                url: options.thinkEndpointUrl,
                headers: { authorization: `bearer ${options.thinkApiKey}` },
              },
            }
          : {}),
        ...(options.functions && options.functions.length > 0
          ? { functions: filterFunctionsForSettings(options.functions) }
          : {}),
        ...(options.thinkToolChoice !== undefined ? { toolChoice: options.thinkToolChoice } : {}),
        ...(options.thinkOutputModalities !== undefined && options.thinkOutputModalities.length > 0
          ? { outputModalities: options.thinkOutputModalities }
          : {}),
        ...(typeof options.thinkMaxOutputTokens === 'number' &&
        Number.isInteger(options.thinkMaxOutputTokens) &&
        options.thinkMaxOutputTokens > 0 &&
        Number.isSafeInteger(options.thinkMaxOutputTokens)
          ? { maxOutputTokens: options.thinkMaxOutputTokens }
          : {}),
        ...(managedPrompt ? { managedPrompt } : {}),
      },
      speak: {
        provider: {
          type: 'deepgram',
          model: options.voice || 'aura-asteria-en',
        },
      },
      ...(hasContextMessages ? {} : { greeting: options.greeting }),
      context: effectiveContext,
    },
  };
}

/** Mirrors proxy `normalizeManagedPromptForSession` so Settings JSON matches translator expectations (Issue #539). */
function pickThinkManagedPromptForSettings(raw: ThinkManagedPrompt | undefined): ThinkManagedPrompt | undefined {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return undefined;
  const id = raw.id.trim();
  const out: ThinkManagedPrompt = { id };
  if (typeof raw.version === 'string' && raw.version.trim()) {
    out.version = raw.version.trim();
  }
  if (
    raw.variables !== undefined &&
    raw.variables !== null &&
    typeof raw.variables === 'object' &&
    !Array.isArray(raw.variables)
  ) {
    out.variables = raw.variables;
  }
  return out;
}
