/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Session Management Utilities Tests
 * 
 * These tests validate the SessionManager class and related utilities
 * that handle conversation context in the application layer.
 */

import { 
  SessionManager, 
  generateSessionId, 
  transformConversationHistory,
  cleanupOldSessions,
  setupSessionCleanup,
  SESSION_CONFIG
} from '../test-app/src/session-management';

describe('Session Management Utilities', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('generateSessionId', () => {
    test('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    test('should generate different IDs for different calls', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSessionId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('transformConversationHistory', () => {
    test('should transform conversation history to Deepgram API format', () => {
      const history = [
        {
          role: 'user',
          content: 'Hello, I need help with my project',
          timestamp: 1234567890
        },
        {
          role: 'assistant',
          content: 'I\'d be happy to help! What kind of project are you working on?',
          timestamp: 1234567891
        }
      ];

      const transformed = transformConversationHistory(history);

      expect(transformed).toEqual({
        messages: [
          {
            type: 'History',
            role: 'user',
            content: 'Hello, I need help with my project'
          },
          {
            type: 'History',
            role: 'assistant',
            content: 'I\'d be happy to help! What kind of project are you working on?'
          }
        ]
      });
    });

    test('should handle empty history', () => {
      const transformed = transformConversationHistory([]);
      expect(transformed).toEqual({ messages: [] });
    });

    test('should handle single message', () => {
      const history = [{
        role: 'user',
        content: 'Single message',
        timestamp: 1234567890
      }];

      const transformed = transformConversationHistory(history);
      expect(transformed.messages).toHaveLength(1);
      expect(transformed.messages[0].type).toBe('History');
      expect(transformed.messages[0].role).toBe('user');
      expect(transformed.messages[0].content).toBe('Single message');
    });
  });

  describe('SessionManager', () => {
    describe('createSession', () => {
      test('should create a new session with generated ID', () => {
        const sessionId = sessionManager.createSession();
        
        expect(sessionId).toBeDefined();
        expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
        expect(sessionManager.getCurrentSessionId()).toBe(sessionId);
      });

      test('should create a new session with provided ID', () => {
        const customId = 'custom-session-123';
        const sessionId = sessionManager.createSession(customId);
        
        expect(sessionId).toBe(customId);
        expect(sessionManager.getCurrentSessionId()).toBe(customId);
      });

      test('should set created and last activity timestamps', () => {
        const before = Date.now();
        const sessionId = sessionManager.createSession();
        const after = Date.now();
        
        const session = sessionManager.getAllSessions().get(sessionId);
        expect(session).toBeDefined();
        expect(session.createdAt).toBeGreaterThanOrEqual(before);
        expect(session.createdAt).toBeLessThanOrEqual(after);
        expect(session.lastActivity).toBe(session.createdAt);
      });
    });

    describe('addMessage', () => {
      test('should add message to current session', () => {
        const sessionId = sessionManager.createSession();
        
        const message = {
          role: 'user',
          content: 'Test message',
          timestamp: Date.now()
        };
        
        sessionManager.addMessage(message);
        
        const history = sessionManager.getConversationHistory();
        expect(history).toHaveLength(1);
        expect(history[0]).toEqual(message);
      });

      test('should throw error if no current session', () => {
        const message = {
          role: 'user',
          content: 'Test message',
          timestamp: Date.now()
        };
        
        expect(() => {
          sessionManager.addMessage(message);
        }).toThrow('No current session - create a session first');
      });

      test('should update last activity timestamp', () => {
        const sessionId = sessionManager.createSession();
        const before = Date.now();
        
        sessionManager.addMessage({
          role: 'user',
          content: 'Test message',
          timestamp: Date.now()
        });
        
        const after = Date.now();
        const session = sessionManager.getAllSessions().get(sessionId);
        expect(session.lastActivity).toBeGreaterThanOrEqual(before);
        expect(session.lastActivity).toBeLessThanOrEqual(after);
      });
    });

    describe('getConversationHistory', () => {
      test('should return empty array if no current session', () => {
        const history = sessionManager.getConversationHistory();
        expect(history).toEqual([]);
      });

      test('should return conversation history for current session', () => {
        const sessionId = sessionManager.createSession();
        
        const message1 = {
          role: 'user',
          content: 'First message',
          timestamp: Date.now()
        };
        
        const message2 = {
          role: 'assistant',
          content: 'Second message',
          timestamp: Date.now()
        };
        
        sessionManager.addMessage(message1);
        sessionManager.addMessage(message2);
        
        const history = sessionManager.getConversationHistory();
        expect(history).toHaveLength(2);
        expect(history[0]).toEqual(message1);
        expect(history[1]).toEqual(message2);
      });
    });

    describe('getSessionContext', () => {
      test('should return null if no current session', () => {
        const context = sessionManager.getSessionContext();
        expect(context).toBeNull();
      });

      test('should return session context with transformed history', () => {
        const sessionId = sessionManager.createSession();
        
        sessionManager.addMessage({
          role: 'user',
          content: 'Test message',
          timestamp: Date.now()
        });
        
        const context = sessionManager.getSessionContext();
        expect(context).toBeDefined();
        expect(context.sessionId).toBe(sessionId);
        expect(context.context).toBeDefined();
        expect(context.context.messages).toHaveLength(1);
        expect(context.context.messages[0].type).toBe('History');
        expect(context.context.messages[0].role).toBe('user');
        expect(context.context.messages[0].content).toBe('Test message');
      });

      test('should return context for specific session ID', () => {
        const sessionId1 = sessionManager.createSession('session1');
        sessionManager.addMessage({
          role: 'user',
          content: 'Message 1',
          timestamp: Date.now()
        });
        
        const sessionId2 = sessionManager.createSession('session2');
        sessionManager.addMessage({
          role: 'user',
          content: 'Message 2',
          timestamp: Date.now()
        });
        
        const context1 = sessionManager.getSessionContext('session1');
        const context2 = sessionManager.getSessionContext('session2');
        
        expect(context1.sessionId).toBe('session1');
        expect(context1.context.messages[0].content).toBe('Message 1');
        
        expect(context2.sessionId).toBe('session2');
        expect(context2.context.messages[0].content).toBe('Message 2');
      });
    });

    describe('setCurrentSessionId', () => {
      test('should set current session ID if session exists', () => {
        const sessionId = sessionManager.createSession('test-session');
        sessionManager.createSession('other-session');
        
        sessionManager.setCurrentSessionId('test-session');
        expect(sessionManager.getCurrentSessionId()).toBe('test-session');
      });

      test('should throw error if session does not exist', () => {
        expect(() => {
          sessionManager.setCurrentSessionId('non-existent-session');
        }).toThrow('Session non-existent-session does not exist');
      });
    });

    describe('clearCurrentSessionHistory', () => {
      test('should clear history for current session', () => {
        const sessionId = sessionManager.createSession();
        
        sessionManager.addMessage({
          role: 'user',
          content: 'Test message',
          timestamp: Date.now()
        });
        
        expect(sessionManager.getConversationHistory()).toHaveLength(1);
        
        sessionManager.clearCurrentSessionHistory();
        
        expect(sessionManager.getConversationHistory()).toHaveLength(0);
      });

      test('should do nothing if no current session', () => {
        expect(() => {
          sessionManager.clearCurrentSessionHistory();
        }).not.toThrow();
      });
    });

    describe('deleteSession', () => {
      test('should delete session and clear current if it was current', () => {
        const sessionId = sessionManager.createSession('test-session');
        expect(sessionManager.getCurrentSessionId()).toBe('test-session');
        
        sessionManager.deleteSession('test-session');
        
        expect(sessionManager.getCurrentSessionId()).toBeNull();
        expect(sessionManager.getAllSessions().has('test-session')).toBe(false);
      });

      test('should delete session without affecting current if different', () => {
        const sessionId1 = sessionManager.createSession('session1');
        const sessionId2 = sessionManager.createSession('session2');
        
        sessionManager.deleteSession('session1');
        
        expect(sessionManager.getCurrentSessionId()).toBe('session2');
        expect(sessionManager.getAllSessions().has('session1')).toBe(false);
        expect(sessionManager.getAllSessions().has('session2')).toBe(true);
      });
    });

    describe('getSessionStats', () => {
      test('should return correct statistics', () => {
        const sessionId = sessionManager.createSession();
        
        sessionManager.addMessage({
          role: 'user',
          content: 'Message 1',
          timestamp: Date.now()
        });
        
        sessionManager.addMessage({
          role: 'assistant',
          content: 'Message 2',
          timestamp: Date.now()
        });
        
        const stats = sessionManager.getSessionStats();
        
        expect(stats.totalSessions).toBe(1);
        expect(stats.currentSessionMessages).toBe(2);
        expect(stats.currentSessionAge).toBeGreaterThanOrEqual(0);
      });

      test('should return zero stats when no sessions', () => {
        const stats = sessionManager.getSessionStats();
        
        expect(stats.totalSessions).toBe(0);
        expect(stats.currentSessionMessages).toBe(0);
        expect(stats.currentSessionAge).toBe(0);
      });
    });
  });

  describe('cleanupOldSessions', () => {
    test('should clean up old sessions', () => {
      // Create a session with old timestamp
      const oldSessionId = sessionManager.createSession('old-session');
      
      // Create a recent session
      const recentSessionId = sessionManager.createSession('recent-session');
      
      // Use proper method to update session activity to make it old
      sessionManager.updateSessionActivity('old-session', Date.now() - (SESSION_CONFIG.MAX_SESSION_AGE + 10000));
      
      // Run cleanup
      cleanupOldSessions(sessionManager);
      
      // Old session should be deleted, recent session should remain
      expect(sessionManager.getAllSessions().has('old-session')).toBe(false);
      expect(sessionManager.getAllSessions().has('recent-session')).toBe(true);
    });

    test('should not clean up recent sessions', () => {
      const sessionId = sessionManager.createSession('recent-session');
      
      cleanupOldSessions(sessionManager);
      
      expect(sessionManager.getAllSessions().has('recent-session')).toBe(true);
    });
  });

  describe('setupSessionCleanup', () => {
    test('should set up cleanup interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      setupSessionCleanup(sessionManager);
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        SESSION_CONFIG.CLEANUP_INTERVAL
      );
      
      setIntervalSpy.mockRestore();
    });
  });

  describe('SESSION_CONFIG', () => {
    test('should have correct configuration values', () => {
      expect(SESSION_CONFIG.MAX_HISTORY_LENGTH).toBe(50);
      expect(SESSION_CONFIG.MAX_SESSION_AGE).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(SESSION_CONFIG.CLEANUP_INTERVAL).toBe(60 * 60 * 1000); // 1 hour
    });
  });
});
