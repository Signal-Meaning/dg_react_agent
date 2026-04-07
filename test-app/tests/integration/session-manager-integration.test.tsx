/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * SessionManager Integration Tests
 * 
 * These tests validate the SessionManager functionality in isolation.
 * Component integration tests are complex due to Jest module resolution issues.
 */

import type { ConversationMessage } from '../../src/session-management';
import { SessionManager } from '../../src/session-management';

describe('SessionManager Integration Tests', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    // Clean up any test sessions
    const sessions = sessionManager.getAllSessions();
    sessions.forEach((_session, sessionId) => {
      sessionManager.deleteSession(sessionId);
    });
  });

  test('should create session and manage context', () => {
    const sessionId = sessionManager.createSession();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');

    const context = sessionManager.getSessionContext(sessionId);
    expect(context).not.toBeNull();
    expect(context!.context.messages).toEqual([]);
  });

  test('should maintain conversation history across operations', () => {
    const sessionId = sessionManager.createSession();
    
    // Add messages
    const userMessage: ConversationMessage = { role: 'user', content: 'Hello', timestamp: Date.now() };
    const agentMessage: ConversationMessage = {
      role: 'assistant',
      content: 'Hi there!',
      timestamp: Date.now(),
    };
    
    sessionManager.addMessage(userMessage);
    sessionManager.addMessage(agentMessage);
    
    const context = sessionManager.getSessionContext(sessionId);
    expect(context).not.toBeNull();
    expect(context!.context.messages).toHaveLength(2);
    expect(context!.context.messages[0].content).toBe('Hello');
    expect(context!.context.messages[1].content).toBe('Hi there!');
  });

  test('should handle multiple sessions independently', () => {
    const session1 = sessionManager.createSession();
    const session2 = sessionManager.createSession();
    
    expect(session1).not.toBe(session2);
    
    // Switch to session1 and add message
    sessionManager.setCurrentSessionId(session1);
    sessionManager.addMessage({
      role: 'user',
      content: 'Session 1 message',
      timestamp: Date.now(),
    });
    
    // Switch to session2 and add message
    sessionManager.setCurrentSessionId(session2);
    sessionManager.addMessage({
      role: 'user',
      content: 'Session 2 message',
      timestamp: Date.now(),
    });
    
    const context1 = sessionManager.getSessionContext(session1);
    const context2 = sessionManager.getSessionContext(session2);

    expect(context1).not.toBeNull();
    expect(context2).not.toBeNull();
    expect(context1!.context.messages).toHaveLength(1);
    expect(context2!.context.messages).toHaveLength(1);
    expect(context1!.context.messages[0].content).toBe('Session 1 message');
    expect(context2!.context.messages[0].content).toBe('Session 2 message');
  });

  test('should handle session cleanup', () => {
    const sessionId = sessionManager.createSession();
    sessionManager.addMessage({ role: 'user', content: 'Test message', timestamp: Date.now() });
    
    expect(sessionManager.getSessionContext(sessionId)).toBeDefined();
    
    sessionManager.deleteSession(sessionId);
    
    expect(sessionManager.getSessionContext(sessionId)).toBeNull();
  });

  test('should handle errors gracefully', () => {
    // Test with invalid session ID
    const invalidContext = sessionManager.getSessionContext('invalid-id');
    expect(invalidContext).toBeNull();
    
    // Test deleting non-existent session
    expect(() => sessionManager.deleteSession('invalid-id')).not.toThrow();
  });
});