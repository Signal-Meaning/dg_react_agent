/**
 * Registry of approved post-fork additions to component's public API
 * 
 * PROCESS: Any addition to DeepgramVoiceInteractionHandle must be:
 * 1. Documented here with issue reference and rationale
 * 2. Added to appropriate release notes (API-CHANGES.md)
 * 3. Approved before merge
 */

export const APPROVED_COMPONENT_METHOD_ADDITIONS = {
  // APPROVED ADDITIONS
  'injectUserMessage': {
    addedIn: 'v0.5.0',
    issue: 'ISSUE-XXX',
    rationale: 'User message injection for text-only interactions. May be unified with injectMessage(role, message) in future.',
    breaking: false,
  },
  'startAudioCapture': {
    addedIn: 'v0.5.0',
    issue: 'ISSUE-XXX',
    rationale: 'Lazy microphone initialization. Enables explicit audio capture control.',
    breaking: false,
    confirmed: true, // Confirmed as intentional addition
  },
  'getAudioContext': {
    addedIn: 'v0.5.0',
    issue: 'ISSUE-XXX',
    rationale: 'Required for browser AudioContext management. Used in test-app to resume suspended AudioContext (line 791). Necessary for autoplay policy compliance.',
    breaking: false,
    requiredBy: 'Browser autoplay policies',
    usage: 'test-app/src/App.tsx:791',
  },
  
  // UNDER REVIEW - debate needed
  'getConnectionStates': {
    addedIn: 'v0.5.0',
    issue: 'ISSUE-XXX',
    rationale: 'Connection state inspection. Used in test-app to check if agent connection is closed.',
    breaking: false,
    requiresDebate: true,
    question: 'Can test-app get this info from onConnectionStateChange callback instead?',
    usage: 'test-app/src/App.tsx:488',
  },
  'getState': {
    addedIn: 'v0.5.0',
    issue: 'ISSUE-XXX',
    rationale: 'Component state inspection for debugging.',
    breaking: false,
    requiresDebate: true,
    question: 'Can test-app get this info from existing callbacks (onAgentStateChange, etc.)?',
  },
  
  // REDUNDANT - should be removed
  'isPlaybackActive': {
    addedIn: 'v0.5.0',
    issue: 'ISSUE-XXX',
    rationale: 'Audio playback state query.',
    breaking: false,
    redundant: true,
    reason: 'Test-app uses onPlaybackStateChange callback (line 297). Method is redundant.',
    replacement: 'Use onPlaybackStateChange callback',
    shouldRemove: true,
  },
} as const;

// Methods that must be removed
export const METHODS_TO_REMOVE = {
  'connectTextOnly': {
    reason: 'Redundant with start() method',
    replacement: 'start()',
    removeImmediately: true,
  },
} as const;

