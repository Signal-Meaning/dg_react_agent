/**
 * Pre-Fork Component API Baseline
 * 
 * Extracted from commit: 7191eb4a062f35344896e873f02eba69c9c46a2d
 * This is the trusted baseline for component's public API
 * 
 * Source of Truth: DeepgramVoiceInteractionHandle interface pre-fork
 */

export const PRE_FORK_COMPONENT_METHODS = [
  'start',
  'stop',
  'updateAgentInstructions',
  'interruptAgent',
  'sleep',
  'wake',
  'toggleSleep',
  'injectAgentMessage',
] as const;

export type PreForkMethod = typeof PRE_FORK_COMPONENT_METHODS[number];

