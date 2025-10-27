/**
 * Registry of approved additions to Deepgram Voice Agent server events
 * 
 * Some events handled by component are not in official asyncapi.yml spec.
 * This file documents why these events are handled and their justification.
 * 
 * PROCESS: Any event not in OFFICIAL_DEEPGRAM_SERVER_EVENTS must be:
 * 1. Documented here with issue reference and rationale
 * 2. Justified why it's in the component's AgentResponseType enum
 * 3. Either: Added to official spec, or explicitly approved as internal addition
 */

export const APPROVED_SERVER_EVENT_ADDITIONS = {
  'Welcome': {
    rationale: 'Pre-fork event, initial connection greeting. Standard WebSocket handshake.',
    addedIn: 'pre-fork',
    needsOfficialVerification: true,
  },
  'UserStoppedSpeaking': {
    rationale: 'Added post-fork for VAD (Voice Activity Detection). May be in older Deepgram spec.',
    addedIn: 'post-fork',
    needsOfficialVerification: true,
  },
  'UtteranceEnd': {
    rationale: 'VAD event added post-fork. Speech endpointing with word timing.',
    addedIn: 'post-fork',
    needsOfficialVerification: true,
  },
  'VADEvent': {
    rationale: 'Generic VAD event. May be in older Deepgram spec or internal implementation.',
    addedIn: 'post-fork',
    needsOfficialVerification: true,
  },
  'FunctionCallResponse': {
    rationale: 'Client response to FunctionCallRequest. Part of function calling feature.',
    addedIn: 'pre-fork',
    needsOfficialVerification: false, // This is client->server, not server->client
  },
  'Error': {
    rationale: 'Error handling. Standard WebSocket error messages. Not in asyncapi.yml events but exists as error handling.',
    addedIn: 'pre-fork',
    needsOfficialVerification: false,
  },
  'Warning': {
    rationale: 'Non-fatal issues reported by Deepgram. Part of Voice Agent v1 API.',
    addedIn: 'post-fork',
    needsOfficialVerification: true,
  },
} as const;

