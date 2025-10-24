/**
 * Session Management Utilities for Deepgram Voice Interaction
 * 
 * This module provides utilities for managing conversation sessions and context
 * in the application layer, as required by Deepgram's stateless WebSocket model.
 * 
 * Key Principles:
 * - Each WebSocket connection is a complete session
 * - No server-side session persistence
 * - Client must provide context when reconnecting
 * - Session management belongs in the application layer
 */

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionContext {
  sessionId: string;
  conversationHistory: ConversationMessage[];
  createdAt: number;
  lastActivity: number;
}

/**
 * Generate a unique session ID for conversation tracking
 * 
 * @returns A unique session identifier
 */
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Transform conversation history to Deepgram API format
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
 * Session Manager Class
 * 
 * Manages conversation sessions in the application layer.
 * Provides methods for creating, updating, and retrieving session context.
 */
export class SessionManager {
  private sessions: Map<string, SessionContext> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Create a new session
   * 
   * @param sessionId - Optional session ID, will generate one if not provided
   * @returns The session ID
   */
  createSession(sessionId?: string): string {
    const id = sessionId || generateSessionId();
    const now = Date.now();
    
    this.sessions.set(id, {
      sessionId: id,
      conversationHistory: [],
      createdAt: now,
      lastActivity: now
    });
    
    this.currentSessionId = id;
    return id;
  }

  /**
   * Get the current session ID
   * 
   * @returns Current session ID or null if no session exists
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set the current session ID
   * 
   * @param sessionId - The session ID to set as current
   */
  setCurrentSessionId(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId;
    } else {
      throw new Error(`Session ${sessionId} does not exist`);
    }
  }

  /**
   * Add a message to the current session's conversation history
   * 
   * @param message - The message to add
   */
  addMessage(message: ConversationMessage): void {
    if (!this.currentSessionId) {
      throw new Error('No current session - create a session first');
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      throw new Error(`Current session ${this.currentSessionId} not found`);
    }

    session.conversationHistory.push(message);
    session.lastActivity = Date.now();
  }

  /**
   * Get the conversation history for the current session
   * 
   * @returns Array of conversation messages
   */
  getConversationHistory(): ConversationMessage[] {
    if (!this.currentSessionId) {
      return [];
    }

    const session = this.sessions.get(this.currentSessionId);
    return session ? session.conversationHistory : [];
  }

  /**
   * Get the conversation history for a specific session
   * 
   * @param sessionId - The session ID
   * @returns Array of conversation messages
   */
  getSessionHistory(sessionId: string): ConversationMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.conversationHistory : [];
  }

  /**
   * Get the full session context for Deepgram API
   * 
   * @param sessionId - Optional session ID, uses current if not provided
   * @returns Session context with conversation history in Deepgram format
   */
  getSessionContext(sessionId?: string): { sessionId: string; context: { messages: Array<{type: string, role: string, content: string}> } } | null {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return null;
    }

    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    return {
      sessionId: id,
      context: transformConversationHistory(session.conversationHistory)
    };
  }

  /**
   * Clear the conversation history for the current session
   */
  clearCurrentSessionHistory(): void {
    if (!this.currentSessionId) {
      return;
    }

    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.conversationHistory = [];
      session.lastActivity = Date.now();
    }
  }

  /**
   * Get all sessions
   * 
   * @returns Map of all sessions
   */
  getAllSessions(): Map<string, SessionContext> {
    return new Map(this.sessions);
  }

  /**
   * Delete a session
   * 
   * @param sessionId - The session ID to delete
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Get session statistics
   * 
   * @returns Object with session statistics
   */
  getSessionStats(): { totalSessions: number; currentSessionMessages: number; currentSessionAge: number } {
    const currentSession = this.currentSessionId ? this.sessions.get(this.currentSessionId) : null;
    
    return {
      totalSessions: this.sessions.size,
      currentSessionMessages: currentSession ? currentSession.conversationHistory.length : 0,
      currentSessionAge: currentSession ? Date.now() - currentSession.createdAt : 0
    };
  }
}

/**
 * Default session manager instance
 * Applications can use this singleton or create their own instances
 */
export const sessionManager = new SessionManager();

/**
 * Constants for session management
 */
export const SESSION_CONFIG = {
  /** Maximum conversation history length to preserve */
  MAX_HISTORY_LENGTH: 50,
  
  /** Maximum session age in milliseconds (24 hours) */
  MAX_SESSION_AGE: 24 * 60 * 60 * 1000,
  
  /** Cleanup interval in milliseconds (1 hour) */
  CLEANUP_INTERVAL: 60 * 60 * 1000
} as const;

/**
 * Cleanup old sessions
 * 
 * @param sessionManager - The session manager instance to clean up
 */
export const cleanupOldSessions = (sessionManager: SessionManager): void => {
  const now = Date.now();
  const sessionsToDelete: string[] = [];

  sessionManager.getAllSessions().forEach((session, sessionId) => {
    const age = now - session.lastActivity;
    
    if (age > SESSION_CONFIG.MAX_SESSION_AGE) {
      sessionsToDelete.push(sessionId);
    }
  });

  sessionsToDelete.forEach(sessionId => {
    sessionManager.deleteSession(sessionId);
  });

  if (sessionsToDelete.length > 0) {
    console.log(`Cleaned up ${sessionsToDelete.length} old sessions`);
  }
};

/**
 * Set up automatic session cleanup
 * 
 * @param sessionManager - The session manager instance to set up cleanup for
 */
export const setupSessionCleanup = (sessionManager: SessionManager): void => {
  setInterval(() => {
    cleanupOldSessions(sessionManager);
  }, SESSION_CONFIG.CLEANUP_INTERVAL);
};
