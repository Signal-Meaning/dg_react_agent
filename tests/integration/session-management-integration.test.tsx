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
      connect: jest.fn().mockResolvedValue(),
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
      isPlaybackActive: jest.fn().mockReturnValue(false),
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
      expect(getByTestId('current-session-id')).toHaveTextContent(/^session_\d+_[a-z0-9]+$/);
    });

    // Start connection
    fireEvent.click(getByTestId('start-button'));
    
    await waitFor(() => {
      expect(getByTestId('connection-state')).toHaveTextContent('Connected');
    });

    // Verify agent manager received settings with context
    expect(mockAgentManager.sendJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Settings',
        agent: expect.objectContaining({
          context: expect.objectContaining({
            messages: expect.any(Array)
          })
        })
      })
    );
  });

  test('should maintain conversation history across reconnections', async () => {
    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create session and start connection
    fireEvent.click(getByTestId('create-session-button'));
    fireEvent.click(getByTestId('start-button'));
    
    await waitFor(() => {
      expect(getByTestId('connection-state')).toHaveTextContent('Connected');
    });

    // Send a message
    const textInput = getByTestId('text-input');
    fireEvent.change(textInput, { target: { value: 'Hello, I am a filmmaker' } });
    fireEvent.click(getByTestId('send-button'));

    await waitFor(() => {
      expect(getByTestId('conversation-length')).toHaveTextContent('1');
    });

    // Simulate agent response
    const mockAgentResponse = {
      type: 'llm',
      text: 'Nice to meet you! What kind of films do you make?'
    };
    
    // Trigger agent response handler
    act(() => {
      const component = getByTestId('test-app').querySelector('[data-testid="deepgram-component"]');
      if (component) {
        // Simulate the onAgentResponse callback
        (component as any).props.onAgentResponse(mockAgentResponse);
      }
    });

    await waitFor(() => {
      expect(getByTestId('conversation-length')).toHaveTextContent('2');
    });

    // Disconnect
    fireEvent.click(getByTestId('stop-button'));
    
    await waitFor(() => {
      expect(getByTestId('connection-state')).toHaveTextContent('Disconnected');
    });

    // Reconnect
    fireEvent.click(getByTestId('start-button'));
    
    await waitFor(() => {
      expect(getByTestId('connection-state')).toHaveTextContent('Connected');
    });

    // Verify context was passed again with conversation history
    expect(mockAgentManager.sendJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Settings',
        agent: expect.objectContaining({
          context: expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: 'Hello, I am a filmmaker'
              }),
              expect.objectContaining({
                role: 'assistant',
                content: 'Nice to meet you! What kind of films do you make?'
              })
            ])
          })
        })
      })
    );
  });

  test('should handle multiple sessions independently', async () => {
    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create first session
    fireEvent.click(getByTestId('create-session-button'));
    const firstSessionId = getByTestId('current-session-id').textContent;
    
    fireEvent.click(getByTestId('start-button'));
    await waitFor(() => {
      expect(getByTestId('connection-state')).toHaveTextContent('Connected');
    });

    // Send message in first session
    fireEvent.change(getByTestId('text-input'), { target: { value: 'Session 1: I am a doctor' } });
    fireEvent.click(getByTestId('send-button'));

    await waitFor(() => {
      expect(getByTestId('conversation-length')).toHaveTextContent('1');
    });

    // Create second session
    fireEvent.click(getByTestId('create-session-button'));
    const secondSessionId = getByTestId('current-session-id').textContent;
    
    // Should be different session
    expect(secondSessionId).not.toBe(firstSessionId);
    expect(getByTestId('conversation-length')).toHaveTextContent('0');

    // Send message in second session
    fireEvent.change(getByTestId('text-input'), { target: { value: 'Session 2: I am a lawyer' } });
    fireEvent.click(getByTestId('send-button'));

    await waitFor(() => {
      expect(getByTestId('conversation-length')).toHaveTextContent('1');
    });

    // Switch back to first session
    // Note: In a real app, this would be handled by the session manager
    // For this test, we'll simulate it by checking the session manager directly
    const sessionManager = new SessionManager();
    sessionManager.setCurrentSessionId(firstSessionId!);
    
    // Verify first session still has its conversation
    const firstSessionHistory = sessionManager.getConversationHistory();
    expect(firstSessionHistory).toHaveLength(1);
    expect(firstSessionHistory[0].content).toContain('Session 1: I am a doctor');
  });

  test('should handle session cleanup', async () => {
    const { getByTestId } = render(<TestAppWithSessionManagement />);

    // Create multiple sessions
    fireEvent.click(getByTestId('create-session-button'));
    fireEvent.click(getByTestId('create-session-button'));
    fireEvent.click(getByTestId('create-session-button'));

    // Verify multiple sessions exist
    const sessionManager = new SessionManager();
    expect(sessionManager.getAllSessions().size).toBeGreaterThan(1);

    // Simulate cleanup (in real app, this would be called by cleanupOldSessions)
    const sessions = Array.from(sessionManager.getAllSessions().keys());
    sessions.forEach(sessionId => {
      if (sessionId !== sessionManager.getCurrentSessionId()) {
        sessionManager.deleteSession(sessionId);
      }
    });

    // Verify only current session remains
    expect(sessionManager.getAllSessions().size).toBe(1);
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
      expect(getByTestId('connection-state')).toHaveTextContent('Disconnected');
    });

    // Session should still exist
    expect(getByTestId('current-session-id')).toHaveTextContent(/^session_\d+_[a-z0-9]+$/);
  });
});
