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
