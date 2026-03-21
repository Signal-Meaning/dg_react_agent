/**
 * Build Settings message payload (Phase 2 refactor – Issue #489 / REFACTORING-PLAN-release-v0.9.8)
 *
 * Pure function: options (with context) + config → Settings message object.
 * No side effects; used by sendAgentSettings in the component.
 */

import type { AgentFunction, ThinkToolChoice } from '../types/agent';
import { filterFunctionsForSettings } from './function-utils';

export interface BuildSettingsMessageOptions {
  language?: string;
  instructions?: string;
  voice?: string;
  thinkProviderType?: string;
  thinkModel?: string;
  thinkEndpointUrl?: string;
  thinkApiKey?: string;
  /** Passed to Settings agent.think.provider.temperature (OpenAI Realtime session.update; Issue #538). */
  thinkTemperature?: number;
  /** Passed to Settings agent.think.toolChoice → Realtime session.tool_choice (Issue #535). */
  thinkToolChoice?: ThinkToolChoice;
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
      endpoint?: unknown;
      functions?: AgentFunction[];
    };
    speak: { provider: { type: string; model: string } };
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

  return {
    type: 'Settings',
    audio: {
      input: { encoding: 'linear16', sample_rate: 16000 },
      output: { encoding: 'linear16', sample_rate: 24000 },
    },
    agent: {
      ...(isOpenAIProxy ? { idleTimeoutMs: options.idleTimeoutMs ?? defaultIdleTimeoutMs } : {}),
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
