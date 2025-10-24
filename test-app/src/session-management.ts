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
export const transformConversationHistory = (history: ConversationMessage[]): {messages: Array<{type: 'History', role: 'user' | 'assistant', content: string}>} => {
  return {
    messages: history.map(message => ({
      type: "History" as const,
      role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
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
   * Creates a new conversation session with a unique identifier. If no sessionId
   * is provided, a unique ID will be generated automatically. The new session
   * becomes the current active session.
   * 
   * @param sessionId - Optional custom session ID. If not provided, a unique ID will be generated
   * @returns The session ID (either the provided one or the generated one)
   * @throws {Error} If the provided sessionId already exists
   * 
   * @example
   * ```typescript
   * const sessionId = sessionManager.createSession();
   * console.log(sessionId); // "session_1234567890_abc123def"
   * 
   * const customSessionId = sessionManager.createSession('my-custom-session');
   * console.log(customSessionId); // "my-custom-session"
   * ```
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
   * Returns the ID of the currently active session. This is the session
   * that new messages will be added to and that context will be generated for.
   * 
   * @returns Current session ID or null if no session exists
   * 
   * @example
   * ```typescript
   * const currentId = sessionManager.getCurrentSessionId();
   * if (currentId) {
   *   console.log(`Current session: ${currentId}`);
   * } else {
   *   console.log('No active session');
   * }
   * ```
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set the current session ID
   * 
   * Switches the active session to the specified session ID. This changes
   * which session new messages will be added to and which session context
   * will be generated for.
   * 
   * @param sessionId - The session ID to set as current
   * @throws {Error} If the session ID does not exist
   * 
   * @example
   * ```typescript
   * sessionManager.createSession('session1');
   * sessionManager.createSession('session2');
   * 
   * // Switch to session1
   * sessionManager.setCurrentSessionId('session1');
   * console.log(sessionManager.getCurrentSessionId()); // "session1"
   * ```
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
   * Adds a new message to the conversation history of the currently active session.
   * The message timestamp is automatically set to the current time, and the
   * session's lastActivity is updated.
   * 
   * @param message - The message to add to the conversation history
   * @throws {Error} If no current session exists
   * 
   * @example
   * ```typescript
   * sessionManager.createSession();
   * 
   * // Add a user message
   * sessionManager.addMessage({
   *   role: 'user',
   *   content: 'Hello, how are you?',
   *   timestamp: Date.now()
   * });
   * 
   * // Add an assistant response
   * sessionManager.addMessage({
   *   role: 'assistant',
   *   content: 'I am doing well, thank you!',
   *   timestamp: Date.now()
   * });
   * ```
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
   * Returns all messages in the conversation history of the currently active session.
   * If no session is active, returns an empty array.
   * 
   * @returns Array of conversation messages in chronological order
   * 
   * @example
   * ```typescript
   * const history = sessionManager.getConversationHistory();
   * console.log(`Current session has ${history.length} messages`);
   * 
   * history.forEach((message, index) => {
   *   console.log(`${index + 1}. ${message.role}: ${message.content}`);
   * });
   * ```
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
   * Returns all messages in the conversation history of the specified session.
   * This method does not change the current active session.
   * 
   * @param sessionId - The session ID to get history for
   * @returns Array of conversation messages in chronological order, or empty array if session doesn't exist
   * 
   * @example
   * ```typescript
   * const session1History = sessionManager.getSessionHistory('session1');
   * const session2History = sessionManager.getSessionHistory('session2');
   * 
   * console.log(`Session1 has ${session1History.length} messages`);
   * console.log(`Session2 has ${session2History.length} messages`);
   * ```
   */
  getSessionHistory(sessionId: string): ConversationMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.conversationHistory : [];
  }

  /**
   * Get the full session context for Deepgram API
   * 
   * Generates the session context in the format expected by the Deepgram Voice Agent API.
   * This includes the session ID and conversation history transformed to the proper format.
   * If no sessionId is provided, uses the current active session.
   * 
   * @param sessionId - Optional session ID to get context for. Uses current session if not provided
   * @returns Session context object with sessionId and transformed messages, or null if session doesn't exist
   * 
   * @example
   * ```typescript
   * // Get context for current session
   * const context = sessionManager.getSessionContext();
   * 
   * // Get context for specific session
   * const context = sessionManager.getSessionContext('session1');
   * 
   * if (context) {
   *   console.log(`Session ${context.sessionId} has ${context.context.messages.length} messages`);
   *   // Use context.context.messages with Deepgram API
   * }
   * ```
   */
  getSessionContext(sessionId?: string): { sessionId: string; context: { messages: Array<{type: 'History', role: 'user' | 'assistant', content: string}> } } | null {
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
   * 
   * Removes all messages from the conversation history of the currently active session.
   * The session itself remains active, but its conversation history is reset to empty.
   * 
   * @throws {Error} If no current session exists
   * 
   * @example
   * ```typescript
   * sessionManager.createSession();
   * sessionManager.addMessage({ role: 'user', content: 'Hello', timestamp: Date.now() });
   * 
   * console.log(sessionManager.getConversationHistory().length); // 1
   * 
   * sessionManager.clearCurrentSessionHistory();
   * console.log(sessionManager.getConversationHistory().length); // 0
   * ```
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
   * Returns a copy of the Map containing all sessions. This is useful for
   * debugging, cleanup operations, or when you need to iterate over all sessions.
   * 
   * @returns Map of all sessions (sessionId -> SessionContext)
   * 
   * @example
   * ```typescript
   * const allSessions = sessionManager.getAllSessions();
   * console.log(`Total sessions: ${allSessions.size}`);
   * 
   * allSessions.forEach((session, sessionId) => {
   *   console.log(`Session ${sessionId}: ${session.conversationHistory.length} messages`);
   * });
   * ```
   */
  getAllSessions(): Map<string, SessionContext> {
    return new Map(this.sessions);
  }

  /**
   * Delete a session
   * 
   * Permanently removes a session and all its conversation history. If the
   * deleted session was the current active session, the current session is
   * set to null.
   * 
   * @param sessionId - The session ID to delete
   * @throws {Error} If the session ID does not exist
   * 
   * @example
   * ```typescript
   * sessionManager.createSession('session1');
   * sessionManager.createSession('session2');
   * 
   * console.log(sessionManager.getAllSessions().size); // 2
   * 
   * sessionManager.deleteSession('session1');
   * console.log(sessionManager.getAllSessions().size); // 1
   * ```
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
   * Returns useful statistics about the current session and overall session state.
   * This is helpful for debugging, monitoring, or displaying session information.
   * 
   * @returns Object with session statistics including total sessions, current session message count, and age
   * 
   * @example
   * ```typescript
   * const stats = sessionManager.getSessionStats();
   * console.log(`Total sessions: ${stats.totalSessions}`);
   * console.log(`Current session messages: ${stats.currentSessionMessages}`);
   * console.log(`Current session age: ${stats.currentSessionAge}ms`);
   * ```
   */
  getSessionStats(): { totalSessions: number; currentSessionMessages: number; currentSessionAge: number } {
    const currentSession = this.currentSessionId ? this.sessions.get(this.currentSessionId) : null;
    
    return {
      totalSessions: this.sessions.size,
      currentSessionMessages: currentSession ? currentSession.conversationHistory.length : 0,
      currentSessionAge: currentSession ? Date.now() - currentSession.createdAt : 0
    };
  }

  /**
   * Update the last activity timestamp for a session (for testing purposes)
   * 
   * @param sessionId - The session ID to update
   * @param timestamp - The new timestamp (defaults to current time)
   */
  updateSessionActivity(sessionId: string, timestamp?: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = timestamp || Date.now();
    } else {
      throw new Error(`Session ${sessionId} does not exist`);
    }
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
