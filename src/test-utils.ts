/**
 * Test Utilities for Deepgram Voice Interaction
 * 
 * This module provides testing utilities for developers using the dg_react_agent library.
 * These utilities help with E2E testing, mocking, and test setup.
 */

// Re-export test helpers for external use
export * from './test-utils/test-helpers';

// Additional test utilities can be added here
export const TEST_CONSTANTS = {
  DEFAULT_TIMEOUT: 5000,
  CONNECTION_TIMEOUT: 10000,
  GREETING_TIMEOUT: 8000,
} as const;

export const MOCK_RESPONSES = {
  WELCOME: {
    type: 'Welcome',
    request_id: 'mock-request-id-12345'
  },
  SETTINGS_APPLIED: {
    type: 'SettingsApplied'
  },
  AGENT_RESPONSE: (userMessage: string) => ({
    type: 'ConversationText',
    role: 'assistant',
    content: `[MOCK] I received your message: "${userMessage}". How can I help you with that?`
  })
} as const;
