/**
 * AUTO-GENERATED from github.com/deepgram/deepgram-api-specs
 * DO NOT EDIT MANUALLY
 * 
 * Official Deepgram Voice Agent v1 API server events
 * Source: https://github.com/deepgram/deepgram-api-specs/blob/main/asyncapi.yml
 * 
 * These are events sent FROM Deepgram server TO client
 */

export const OFFICIAL_DEEPGRAM_SERVER_EVENTS = [
  'AgentAudioDone',
  'AgentStartedSpeaking',
  'AgentThinking',
  'ConversationText',
  'FunctionCallRequest',
  'InjectionRefused',
  'PromptUpdated',
  'SettingsApplied',
  'SpeakUpdated',
  'UserStartedSpeaking',
] as const;

export type OfficialDeepgramEvent = typeof OFFICIAL_DEEPGRAM_SERVER_EVENTS[number];
