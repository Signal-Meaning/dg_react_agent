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
  'allowAgent': {
    addedIn: 'v0.5.1',
    issue: 'Issue #195',
    rationale: 'Counterpart to interruptAgent() for push-button mute control. Allows audio after blocking to enable hold-to-mute interactions.',
    breaking: false,
    confirmed: true,
    usage: 'test-app/src/App.tsx:handleMuteUp',
  },

} as const;

// Methods that must be removed
export const METHODS_TO_REMOVE = {
  'connectTextOnly': {
    reason: 'Redundant with start() method',
    replacement: 'start()',
    removeImmediately: true,
    removed: true,
    removedIn: 'Issue #194',
  },
  'isPlaybackActive': {
    reason: 'Redundant with onPlaybackStateChange callback',
    replacement: 'Use onPlaybackStateChange callback',
    removeImmediately: true,
    removed: true,
    removedIn: 'Issue #195',
  },
  'getConnectionStates': {
    reason: 'Debug method that exposes internal implementation. Not part of public API.',
    replacement: 'onConnectionStateChange callback to track connection state',
    removeImmediately: true,
    removed: false,
    issue: 'Issue #162',
    note: 'Connection state available via onConnectionStateChange(service, state) callback',
  },
  'getState': {
    reason: 'Debug method that exposes internal implementation. Not part of public API.',
    replacement: 'Appropriate callbacks: onReady, onAgentStateChange, onConnectionStateChange, onSettingsApplied, etc.',
    removeImmediately: true,
    removed: false,
    issue: 'Issue #162',
    note: 'Component state available via public callbacks. onSettingsApplied added in Phase 0 to replace hasSentSettings polling.',
  },
} as const;

