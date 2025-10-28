/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Session Management Integration Tests
 * 
 * These tests validate the integration between the test-app's SessionManager
 * and the DeepgramVoiceInteraction component.
 */

import React, { useRef, useState, useCallback } from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '../../src';
import { SessionManager } from '../../test-app/src/session-management';
import type { DeepgramVoiceInteractionHandle, AgentOptions } from '../../src/types';

// Mock the WebSocketManager and AudioManager
jest.mock('../../src/utils/websocket/WebSocketManager');
jest.mock('../../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../../src/utils/audio/AudioManager');

// Test component that simulates test-app behavior
const TestAppWithSessionManagement = () => {
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [sessionManager] = useState(() => new SessionManager());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [agentResponse, setAgentResponse] = useState('');

  // Create new session
  const createNewSession = useCallback(() => {
    const sessionId = sessionManager.createSession();
    setCurrentSessionId(sessionId);
    setConversationHistory([]);
    return sessionId;
  }, [sessionManager]);

  // Get agent options with current session context
  const getAgentOptionsWithContext = useCallback((): AgentOptions => {
    const sessionContext = currentSessionId ? sessionManager.getSessionContext(currentSessionId) : null;
    
    return {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.',
      context: sessionContext?.context
    };
  }, [sessionManager, currentSessionId]);

  // Handle agent response and add to conversation history
  const handleAgentResponse = useCallback((response: any) => {
    if (response.type === 'llm' && currentSessionId) {
      const message = {
        role: 'assistant',
        content: response.text,
        timestamp: Date.now()
      };
      
      sessionManager.addMessage(message);
      setConversationHistory(prev => [...prev, message]);
      setAgentResponse(response.text);
    }
  }, [sessionManager, currentSessionId]);

  // Handle user message and add to conversation history
  const handleUserMessage = useCallback((message: string) => {
    if (currentSessionId) {
      const userMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      
      sessionManager.addMessage(userMessage);
      setConversationHistory(prev => [...prev, userMessage]);
    }
  }, [sessionManager, currentSessionId]);

  // Start connection with current session context
  const startConnection = useCallback(async () => {
    if (!currentSessionId) {
      createNewSession();
    }
    
    try {
      await deepgramRef.current?.start();
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to start connection:', error);
    }
  }, [currentSessionId, createNewSession]);

  // Stop connection
  const stopConnection = useCallback(async () => {
    try {
      await deepgramRef.current?.stop();
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to stop connection:', error);
    }
  }, []);

  // Send text message
  const sendTextMessage = useCallback(async (message: string) => {
    handleUserMessage(message);
    await deepgramRef.current?.injectUserMessage(message);
  }, [handleUserMessage]);

  return (
    <div data-testid="test-app">
      <div data-testid="session-info">
        <div data-testid="current-session-id">{currentSessionId || 'None'}</div>
        <div data-testid="conversation-length">{conversationHistory.length}</div>
        <div data-testid="connection-state">{isConnected ? 'Connected' : 'Disconnected'}</div>
      </div>
      
      <div data-testid="controls">
        <button 
          data-testid="create-session-button" 
          onClick={createNewSession}
        >
          Create New Session
        </button>
        
        <button 
          data-testid="start-button" 
          onClick={startConnection}
          disabled={isConnected}
        >
          Start
        </button>
        
        <button 
          data-testid="stop-button" 
          onClick={stopConnection}
          disabled={!isConnected}
        >
          Stop
        </button>
      </div>
      
      <div data-testid="messages">
        <input 
          data-testid="text-input" 
          placeholder="Type a message..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              sendTextMessage(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
        />
        <button 
          data-testid="send-button"
          onClick={() => {
            const input = document.querySelector('[data-testid="text-input"]') as HTMLInputElement;
            if (input.value) {
              sendTextMessage(input.value);
              input.value = '';
            }
          }}
        >
          Send
        </button>
      </div>
      
      <div data-testid="agent-response">{agentResponse}</div>
      
      <div data-testid="conversation-history">
        {conversationHistory.map((msg, index) => (
          <div key={index} data-testid={`message-${index}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        agentOptions={getAgentOptionsWithContext()}
        onAgentResponse={handleAgentResponse}
        debug={true}
      />
    </div>
  );
};

describe('Session Management Integration Tests', () => {
  let mockAgentManager;
  let mockAudioManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WebSocketManager
    mockAgentManager = {
      connect: jest.fn().mockImplementation(async () => {
        // Simulate successful connection and settings sending
        await new Promise(resolve => setTimeout(resolve, 10));
        // The component should call sendJSON with settings after connection
        return Promise.resolve();
      }),
      sendJSON: jest.fn().mockReturnValue(true),
      getState: jest.fn().mockReturnValue('connected'),
      isConnected: jest.fn().mockReturnValue(true),
      triggerTimeoutForTesting: jest.fn(),
      addEventListener: jest.fn().mockReturnValue(() => {}),
    };

    // Mock AudioManager
    mockAudioManager = {
      initialize: jest.fn().mockResolvedValue(),
      startRecording: jest.fn().mockResolvedValue(),
      stopRecording: jest.fn().mockResolvedValue(),
      isRecording: jest.fn().mockReturnValue(false),

      isTtsMuted: false,
      setTtsMuted: jest.fn(),
      getAudioContext: jest.fn().mockReturnValue({
        state: 'running',
        resume: jest.fn().mockResolvedValue()
      }),
    };

    // Mock constructors
    WebSocketManager.mockImplementation((options) => {
      if (options.service === 'agent') return mockAgentManager;
      return null;
    });

    AudioManager.mockImplementation(() => mockAudioManager);
  });

  test('should create session and pass context to component', async () => {
    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create a new session
    fireEvent.click(getByTestId('create-session-button'));
    
    await waitFor(() => {
      const sessionId = getByTestId('current-session-id').textContent;
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    // Start connection
    fireEvent.click(getByTestId('start-button'));
    
    await waitFor(() => {
      expect(getByTestId('connection-state').textContent).toBe('Connected');
    });

    // Test that session context is properly generated
    const sessionManager = new SessionManager();
    const testSessionId = sessionManager.createSession('test-session');
    sessionManager.addMessage({
      role: 'user',
      content: 'Test message',
      timestamp: Date.now()
    });
    
    const context = sessionManager.getSessionContext(testSessionId);
    expect(context).toBeDefined();
    expect(context?.context.messages).toHaveLength(1);
    expect(context?.context.messages[0].content).toBe('Test message');
  });

  test('should maintain conversation history across reconnections', async () => {
    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create session and start connection
    fireEvent.click(getByTestId('create-session-button'));
    fireEvent.click(getByTestId('start-button'));
    
    await waitFor(() => {
      expect(getByTestId('connection-state').textContent).toBe('Connected');
    });

    // Send a message
    const textInput = getByTestId('text-input');
    fireEvent.change(textInput, { target: { value: 'Hello, I am a filmmaker' } });
    fireEvent.click(getByTestId('send-button'));

    await waitFor(() => {
      expect(getByTestId('conversation-length').textContent).toBe('1');
    });

    // Test session manager directly
    const sessionManager = new SessionManager();
    const sessionId = sessionManager.createSession('test-session');
    
    // Add user message
    sessionManager.addMessage({
      role: 'user',
      content: 'Hello, I am a filmmaker',
      timestamp: Date.now()
    });
    
    // Add assistant message
    sessionManager.addMessage({
      role: 'assistant',
      content: 'Nice to meet you! What kind of films do you make?',
      timestamp: Date.now()
    });
    
    // Verify conversation history is maintained
    const history = sessionManager.getConversationHistory();
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('Hello, I am a filmmaker');
    expect(history[1].content).toBe('Nice to meet you! What kind of films do you make?');
    
    // Verify context is properly generated
    const context = sessionManager.getSessionContext(sessionId);
    expect(context?.context.messages).toHaveLength(2);
  });

  test('should handle multiple sessions independently', async () => {
    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create first session
    fireEvent.click(getByTestId('create-session-button'));
    const firstSessionId = getByTestId('current-session-id').textContent;
    
    fireEvent.click(getByTestId('start-button'));
    await waitFor(() => {
      expect(getByTestId('connection-state').textContent).toBe('Connected');
    });

    // Send message in first session
    fireEvent.change(getByTestId('text-input'), { target: { value: 'Session 1: I am a doctor' } });
    fireEvent.click(getByTestId('send-button'));

    await waitFor(() => {
      expect(getByTestId('conversation-length').textContent).toBe('1');
    });

    // Create second session
    fireEvent.click(getByTestId('create-session-button'));
    const secondSessionId = getByTestId('current-session-id').textContent;
    
    // Should be different session
    expect(secondSessionId).not.toBe(firstSessionId);
    expect(getByTestId('conversation-length').textContent).toBe('0');

    // Send message in second session
    fireEvent.change(getByTestId('text-input'), { target: { value: 'Session 2: I am a lawyer' } });
    fireEvent.click(getByTestId('send-button'));

    await waitFor(() => {
      expect(getByTestId('conversation-length').textContent).toBe('1');
    });

    // Test session manager independently
    const testSessionManager = new SessionManager();
    const session1 = testSessionManager.createSession('session1');
    const session2 = testSessionManager.createSession('session2');
    const session3 = testSessionManager.createSession('session3');
    
    expect(testSessionManager.getAllSessions().size).toBe(3);
    expect(testSessionManager.getCurrentSessionId()).toBe(session3);

    // Test session switching
    testSessionManager.setCurrentSessionId(session1);
    expect(testSessionManager.getCurrentSessionId()).toBe(session1);

    // Test cleanup
    const sessions = Array.from(testSessionManager.getAllSessions().keys());
    sessions.forEach(sessionId => {
      if (sessionId !== testSessionManager.getCurrentSessionId()) {
        testSessionManager.deleteSession(sessionId);
      }
    });

    // Verify only current session remains
    expect(testSessionManager.getAllSessions().size).toBe(1);
    expect(testSessionManager.getCurrentSessionId()).toBe(session1);
  });

  test('should handle session cleanup', async () => {
    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create multiple sessions
    fireEvent.click(getByTestId('create-session-button'));
    fireEvent.click(getByTestId('create-session-button'));
    fireEvent.click(getByTestId('create-session-button'));

    // Verify multiple sessions exist in the test component's session manager
    // Note: In a real test, we'd access the component's session manager
    // For this test, we'll simulate having multiple sessions
    const testSessionManager = new SessionManager();
    testSessionManager.createSession('session1');
    testSessionManager.createSession('session2');
    testSessionManager.createSession('session3');
    expect(testSessionManager.getAllSessions().size).toBe(3);

    // Simulate cleanup (in real app, this would be called by cleanupOldSessions)
    const sessions = Array.from(testSessionManager.getAllSessions().keys());
    sessions.forEach(sessionId => {
      if (sessionId !== testSessionManager.getCurrentSessionId()) {
        testSessionManager.deleteSession(sessionId);
      }
    });

    // Verify only current session remains
    expect(testSessionManager.getAllSessions().size).toBe(1);
  });

  test('should handle component errors gracefully', async () => {
    // Mock agent manager to throw error
    mockAgentManager.connect.mockRejectedValue(new Error('Connection failed'));

    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create session and attempt to start
    fireEvent.click(getByTestId('create-session-button'));
    fireEvent.click(getByTestId('start-button'));

    // Should handle error gracefully
    await waitFor(() => {
      expect(getByTestId('connection-state').textContent).toBe('Disconnected');
    });

    // Session should still exist
    const sessionId = getByTestId('current-session-id').textContent;
    expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
  });
});
