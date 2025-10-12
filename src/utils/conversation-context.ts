import { ConversationMessage } from '../types';

/**
 * Transform internal conversation history to Deepgram API format
 * 
 * This utility function converts our internal ConversationMessage[] format
 * to the format expected by the Deepgram Voice Agent API.
 * 
 * @param history - Array of conversation messages in internal format
 * @returns Object with messages array in Deepgram API format
 */
export const transformConversationHistory = (history: ConversationMessage[]): {messages: Array<{type: string, role: string, content: string}>} => {
  return {
    messages: history.map(message => ({
      type: "History",
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }))
  };
};

/**
 * Generate a unique session ID for conversation tracking
 * 
 * @returns A unique session identifier
 */
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Constants for lazy reconnection behavior
 */
export const LAZY_RECONNECT_CONFIG = {
  /** Delay before sending user message after reconnection (ms) */
  MESSAGE_SEND_DELAY: 500,
  
  /** Maximum conversation history length to preserve */
  MAX_HISTORY_LENGTH: 50,
  
  /** Log prefix for lazy reconnection operations */
  LOG_PREFIX: '🔄 [LAZY_RECONNECT]'
} as const;
