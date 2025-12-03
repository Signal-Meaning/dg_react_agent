/**
 * VAD Events Constants
 * 
 * This file contains constants and documentation for Voice Activity Detection (VAD) events
 * to ensure consistency across the codebase and reduce DRY violations.
 */

/**
 * Real Deepgram VAD Events
 * These are the actual events provided by the Deepgram API
 */
export const REAL_DEEPGRAM_VAD_EVENTS = {
  USER_STARTED_SPEAKING: 'UserStartedSpeaking',
  // NOTE: SpeechStarted was part of old Transcription API, not used in Voice Agent API
  UTTERANCE_END: 'UtteranceEnd'
} as const;

/**
 * Fictional VAD Events (DO NOT USE)
 * These events do not exist in the Deepgram API and should not be used
 */
export const FICTIONAL_VAD_EVENTS = {
  USER_STOPPED_SPEAKING: 'UserStoppedSpeaking',
  SPEECH_STOPPED: 'SpeechStopped'
} as const;

/**
 * VAD Event Documentation Messages
 * Standardized messages for documenting fictional events
 */
export const VAD_EVENT_MESSAGES = {
  FICTIONAL_EVENT_REMOVED: 'Not a real Deepgram event',
  FICTIONAL_EVENT_DOES_NOT_EXIST: 'DOES NOT EXIST',
  USE_UTTERANCE_END: 'Use UtteranceEnd for speech end detection instead',
  FICTIONAL_EVENT_NOTE: 'Fictional Event - This event is not part of the Deepgram API'
} as const;

/**
 * VAD Event Sources
 * Which Deepgram service provides each event
 */
export const VAD_EVENT_SOURCES = {
  [REAL_DEEPGRAM_VAD_EVENTS.USER_STARTED_SPEAKING]: 'Voice Agent API',
  [REAL_DEEPGRAM_VAD_EVENTS.UTTERANCE_END]: 'Voice Agent API'
} as const;

/**
 * VAD Event Status
 * Whether each event is real or fictional
 */
export const VAD_EVENT_STATUS = {
  [REAL_DEEPGRAM_VAD_EVENTS.USER_STARTED_SPEAKING]: '✅ REAL',
  [REAL_DEEPGRAM_VAD_EVENTS.UTTERANCE_END]: '✅ REAL',
  [FICTIONAL_VAD_EVENTS.USER_STOPPED_SPEAKING]: '❌ FICTIONAL',
  [FICTIONAL_VAD_EVENTS.SPEECH_STOPPED]: '❌ FICTIONAL'
} as const;

/**
 * Helper function to check if an event is real
 */
export function isRealVADEvent(eventType: string): boolean {
  return Object.values(REAL_DEEPGRAM_VAD_EVENTS).includes(eventType as (typeof REAL_DEEPGRAM_VAD_EVENTS)[keyof typeof REAL_DEEPGRAM_VAD_EVENTS]);
}

/**
 * Helper function to check if an event is fictional
 */
export function isFictionalVADEvent(eventType: string): boolean {
  return Object.values(FICTIONAL_VAD_EVENTS).includes(eventType as (typeof FICTIONAL_VAD_EVENTS)[keyof typeof FICTIONAL_VAD_EVENTS]);
}

/**
 * Get the source of a VAD event
 */
export function getVADEventSource(eventType: string): string | undefined {
  return VAD_EVENT_SOURCES[eventType as keyof typeof VAD_EVENT_SOURCES];
}

/**
 * Get the status of a VAD event
 */
export function getVADEventStatus(eventType: string): string | undefined {
  return VAD_EVENT_STATUS[eventType as keyof typeof VAD_EVENT_STATUS];
}
