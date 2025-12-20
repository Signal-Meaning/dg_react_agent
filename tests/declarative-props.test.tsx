/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Declarative Props Unit Tests - Issue #305
 * 
 * Comprehensive unit tests for declarative prop logic, covering:
 * - Edge cases (rapid prop changes, invalid combinations, unmounting)
 * - Error handling (when imperative methods fail)
 * - State synchronization (prop changes triggering correct methods, callback timing)
 */

import React, { useRef, useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle, DeepgramVoiceInteractionProps } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, MOCK_API_KEY } from './fixtures/mocks';
import {
  resetTestState,
  setupComponentAndConnect,
  MockWebSocketManager,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Declarative Props - Issue #305', () => {
  let mockAgentManager: MockWebSocketManager;
  let mockTranscriptionManager: MockWebSocketManager;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    resetTestState();
    jest.clearAllMocks();
    
    // Setup mocks
    mockAgentManager = createMockWebSocketManager() as MockWebSocketManager;
    mockTranscriptionManager = createMockWebSocketManager() as MockWebSocketManager;
    mockAudioManager = createMockAudioManager();

    WebSocketManager.mockImplementation((options: any) => {
      if (options.service === 'agent') {
        return mockAgentManager;
      }
      return mockTranscriptionManager;
    });

    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('userMessage prop', () => {
    it('should send message when userMessage prop changes to a non-null value', async () => {
      const onUserMessageSent = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [userMessage, setUserMessage] = useState<string | null>(null);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              userMessage={userMessage}
              onUserMessageSent={onUserMessageSent}
            />
            <button onClick={() => setUserMessage('Hello')}>Send</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      // Setup connection first
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Trigger userMessage prop change
      await act(async () => {
        getByText('Send').click();
      });

      // Wait for injectUserMessage to be called
      await waitFor(() => {
        expect(mockAgentManager.sendJSON).toHaveBeenCalled();
      });

      // Verify message was sent
      const sentMessages = mockAgentManager.sendJSON.mock.calls
        .map((call: any[]) => {
          const msg = typeof call[0] === 'string' ? JSON.parse(call[0]) : call[0];
          return msg;
        })
        .filter((msg: any) => msg.type === 'ConversationText' && msg.role === 'user');

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0].text).toBe('Hello');
      
      // Verify callback was called
      await waitFor(() => {
        expect(onUserMessageSent).toHaveBeenCalled();
      });
    });

    it('should not send message on first render (skip initialization)', async () => {
      const onUserMessageSent = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={{
            language: 'en',
            listenModel: 'nova-3',
            instructions: 'Test',
          }}
          userMessage="Initial Message"
          onUserMessageSent={onUserMessageSent}
        />
      );

      // Wait a bit to ensure no message is sent
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not send on first render
      expect(mockAgentManager.sendJSON).not.toHaveBeenCalled();
      expect(onUserMessageSent).not.toHaveBeenCalled();
    });

    it('should handle rapid prop changes (debouncing behavior)', async () => {
      const onUserMessageSent = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [userMessage, setUserMessage] = useState<string | null>(null);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              userMessage={userMessage}
              onUserMessageSent={() => {
                onUserMessageSent();
                setUserMessage(null);
              }}
            />
            <button onClick={() => {
              setUserMessage('Message 1');
              setTimeout(() => setUserMessage('Message 2'), 10);
              setTimeout(() => setUserMessage('Message 3'), 20);
            }}>Send Rapid</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      await act(async () => {
        getByText('Send Rapid').click();
      });

      // Wait for messages to be processed
      await waitFor(() => {
        expect(mockAgentManager.sendJSON).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Should have sent at least one message (may send multiple if rapid changes are allowed)
      const sentMessages = mockAgentManager.sendJSON.mock.calls
        .map((call: any[]) => {
          const msg = typeof call[0] === 'string' ? JSON.parse(call[0]) : call[0];
          return msg;
        })
        .filter((msg: any) => msg.type === 'ConversationText' && msg.role === 'user');

      expect(sentMessages.length).toBeGreaterThan(0);
    });

    it('should handle error when injectUserMessage fails', async () => {
      const onUserMessageSent = jest.fn();
      const onError = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      // Make sendJSON fail
      mockAgentManager.sendJSON.mockRejectedValueOnce(new Error('Network error'));
      
      const TestComponent = () => {
        const [userMessage, setUserMessage] = useState<string | null>(null);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              userMessage={userMessage}
              onUserMessageSent={onUserMessageSent}
              onError={onError}
            />
            <button onClick={() => setUserMessage('Hello')}>Send</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      await act(async () => {
        getByText('Send').click();
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      // Verify error callback was called with correct error
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agent',
          code: 'user_message_failed',
        })
      );

      // onUserMessageSent should not be called on error
      expect(onUserMessageSent).not.toHaveBeenCalled();
    });

    it('should not send message when prop changes to null', async () => {
      const onUserMessageSent = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [userMessage, setUserMessage] = useState<string | null>('Initial');
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              userMessage={userMessage}
              onUserMessageSent={onUserMessageSent}
            />
            <button onClick={() => setUserMessage(null)}>Clear</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Clear the initial message count
      mockAgentManager.sendJSON.mockClear();
      
      await act(async () => {
        getByText('Clear').click();
      });

      // Wait a bit
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not send when changing to null
      expect(mockAgentManager.sendJSON).not.toHaveBeenCalled();
      expect(onUserMessageSent).not.toHaveBeenCalled();
    });
  });

  describe('connectionState / autoStart props', () => {
    it('should connect when connectionState changes to "connected"', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'auto'>('auto');
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              connectionState={connectionState}
            />
            <button onClick={() => setConnectionState('connected')}>Connect</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      // Initially not connected
      expect(mockAgentManager.connect).not.toHaveBeenCalled();
      
      await act(async () => {
        getByText('Connect').click();
      });

      // Should call start() which will connect
      await waitFor(() => {
        expect(mockAgentManager.connect).toHaveBeenCalled();
      });
    });

    it('should disconnect when connectionState changes to "disconnected"', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'auto'>('connected');
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              connectionState={connectionState}
            />
            <button onClick={() => setConnectionState('disconnected')}>Disconnect</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      // Setup connection first
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Clear previous calls
      mockAgentManager.close.mockClear();
      
      await act(async () => {
        getByText('Disconnect').click();
      });

      // Should call stop() which will close
      await waitFor(() => {
        expect(mockAgentManager.close).toHaveBeenCalled();
      });
    });

    it('should connect when autoStartAgent is set to true', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [autoStartAgent, setAutoStartAgent] = useState<boolean>(false);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              autoStartAgent={autoStartAgent}
            />
            <button onClick={() => setAutoStartAgent(true)}>Start</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await act(async () => {
        getByText('Start').click();
      });

      // Should call start() with agent: true
      await waitFor(() => {
        expect(mockAgentManager.connect).toHaveBeenCalled();
      });
    });

    it('should handle error when start() fails', async () => {
      const onError = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      // Make connect fail
      mockAgentManager.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      const TestComponent = () => {
        const [autoStartAgent, setAutoStartAgent] = useState<boolean>(false);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              autoStartAgent={autoStartAgent}
              onError={onError}
            />
            <button onClick={() => setAutoStartAgent(true)}>Start</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await act(async () => {
        getByText('Start').click();
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agent',
          code: 'connection_start_failed',
        })
      );
    });

    it('should handle error when stop() fails', async () => {
      const onError = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      // Make close fail
      mockAgentManager.close.mockRejectedValueOnce(new Error('Close failed'));
      
      const TestComponent = () => {
        const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'auto'>('connected');
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              connectionState={connectionState}
              onError={onError}
            />
            <button onClick={() => setConnectionState('disconnected')}>Disconnect</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      await act(async () => {
        getByText('Disconnect').click();
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'agent',
          code: 'connection_stop_failed',
        })
      );
    });
  });

  describe('interruptAgent prop', () => {
    it('should interrupt agent when interruptAgent prop changes to true', async () => {
      const onAgentInterrupted = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [interruptAgent, setInterruptAgent] = useState<boolean>(false);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              interruptAgent={interruptAgent}
              onAgentInterrupted={onAgentInterrupted}
            />
            <button onClick={() => setInterruptAgent(true)}>Interrupt</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      await act(async () => {
        getByText('Interrupt').click();
      });

      // Wait for callback
      await waitFor(() => {
        expect(onAgentInterrupted).toHaveBeenCalled();
      });

      // Verify audio was cleared (interruptAgent calls clearAudio)
      expect(mockAudioManager.clearAudioQueue).toHaveBeenCalled();
    });

    it('should not interrupt on first render', async () => {
      const onAgentInterrupted = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={{
            language: 'en',
            listenModel: 'nova-3',
            instructions: 'Test',
          }}
          interruptAgent={true}
          onAgentInterrupted={onAgentInterrupted}
        />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not interrupt on first render
      expect(onAgentInterrupted).not.toHaveBeenCalled();
      expect(mockAudioManager.clearAudioQueue).not.toHaveBeenCalled();
    });

    it('should not interrupt when prop changes to false', async () => {
      const onAgentInterrupted = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [interruptAgent, setInterruptAgent] = useState<boolean>(true);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              interruptAgent={interruptAgent}
              onAgentInterrupted={onAgentInterrupted}
            />
            <button onClick={() => setInterruptAgent(false)}>Allow</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Clear previous calls
      mockAudioManager.clearAudioQueue.mockClear();
      onAgentInterrupted.mockClear();
      
      await act(async () => {
        getByText('Allow').click();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not interrupt when changing to false
      expect(onAgentInterrupted).not.toHaveBeenCalled();
    });
  });

  describe('startAudioCapture prop', () => {
    it('should start audio capture when prop changes to true', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [startAudioCapture, setStartAudioCapture] = useState<boolean>(false);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              startAudioCapture={startAudioCapture}
            />
            <button onClick={() => setStartAudioCapture(true)}>Start Mic</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      // Setup connection first (required for startAudioCapture)
      await setupComponentAndConnect(ref, mockAgentManager);
      
      await act(async () => {
        getByText('Start Mic').click();
      });

      // Wait for startRecording to be called
      await waitFor(() => {
        expect(mockAudioManager.startRecording).toHaveBeenCalled();
      });
    });

    it('should stop audio capture when prop changes to false', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [startAudioCapture, setStartAudioCapture] = useState<boolean>(true);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              startAudioCapture={startAudioCapture}
            />
            <button onClick={() => setStartAudioCapture(false)}>Stop Mic</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Set recording as active
      mockAudioManager.isRecordingActive.mockReturnValue(true);
      
      await act(async () => {
        getByText('Stop Mic').click();
      });

      // Wait for stopRecording to be called
      await waitFor(() => {
        expect(mockAudioManager.stopRecording).toHaveBeenCalled();
      });
    });

    it('should handle error when startAudioCapture() fails', async () => {
      const onError = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      // Make startRecording fail
      mockAudioManager.startRecording.mockRejectedValueOnce(new Error('Microphone access denied'));
      
      const TestComponent = () => {
        const [startAudioCapture, setStartAudioCapture] = useState<boolean>(false);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              startAudioCapture={startAudioCapture}
              onError={onError}
            />
            <button onClick={() => setStartAudioCapture(true)}>Start Mic</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      await act(async () => {
        getByText('Start Mic').click();
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'transcription',
          code: 'audio_capture_start_failed',
        })
      );
    });

    it('should handle error when stopRecording() fails', async () => {
      const onError = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      // Make stopRecording fail
      mockAudioManager.stopRecording.mockImplementationOnce(() => {
        throw new Error('Stop failed');
      });
      
      const TestComponent = () => {
        const [startAudioCapture, setStartAudioCapture] = useState<boolean>(true);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              startAudioCapture={startAudioCapture}
              onError={onError}
            />
            <button onClick={() => setStartAudioCapture(false)}>Stop Mic</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Set recording as active
      mockAudioManager.isRecordingActive.mockReturnValue(true);
      
      await act(async () => {
        getByText('Stop Mic').click();
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'transcription',
          code: 'audio_capture_stop_failed',
        })
      );
    });

    it('should not start if already recording', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [startAudioCapture, setStartAudioCapture] = useState<boolean>(false);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              startAudioCapture={startAudioCapture}
            />
            <button onClick={() => setStartAudioCapture(true)}>Start Mic</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Set recording as already active
      mockAudioManager.isRecordingActive.mockReturnValue(true);
      
      await act(async () => {
        getByText('Start Mic').click();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not start if already recording
      expect(mockAudioManager.startRecording).not.toHaveBeenCalled();
    });

    it('should not stop if not recording', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [startAudioCapture, setStartAudioCapture] = useState<boolean>(true);
        
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              agentOptions={{
                language: 'en',
                listenModel: 'nova-3',
                instructions: 'Test',
              }}
              startAudioCapture={startAudioCapture}
            />
            <button onClick={() => setStartAudioCapture(false)}>Stop Mic</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Set recording as not active
      mockAudioManager.isRecordingActive.mockReturnValue(false);
      
      await act(async () => {
        getByText('Stop Mic').click();
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not stop if not recording
      expect(mockAudioManager.stopRecording).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle component unmounting during prop change', async () => {
      const onUserMessageSent = jest.fn();
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = ({ shouldMount }: { shouldMount: boolean }) => {
        if (!shouldMount) return null;
        
        return (
          <DeepgramVoiceInteraction
            ref={ref}
            apiKey={MOCK_API_KEY}
            agentOptions={{
              language: 'en',
              listenModel: 'nova-3',
              instructions: 'Test',
            }}
            userMessage="Test Message"
            onUserMessageSent={onUserMessageSent}
          />
        );
      };

      const { rerender } = render(<TestComponent shouldMount={true} />);
      
      await setupComponentAndConnect(ref, mockAgentManager);
      
      // Unmount immediately after setting userMessage
      await act(async () => {
        rerender(<TestComponent shouldMount={false} />);
      });

      // Component should unmount gracefully without errors
      // (no assertions needed - test passes if no errors thrown)
    });

    it('should handle invalid prop combinations gracefully', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      // connectionState="connected" but autoStartAgent=false
      // This is a valid combination - connectionState takes precedence
      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={{
            language: 'en',
            listenModel: 'nova-3',
            instructions: 'Test',
          }}
          connectionState="connected"
          autoStartAgent={false}
        />
      );

      // Should not throw errors
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // connectionState should take precedence
      await waitFor(() => {
        expect(mockAgentManager.connect).toHaveBeenCalled();
      });
    });

    it('should handle prop changes when services are not configured', async () => {
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      
      const TestComponent = () => {
        const [autoStartAgent, setAutoStartAgent] = useState<boolean>(false);
        
        // No agentOptions provided
        return (
          <>
            <DeepgramVoiceInteraction
              ref={ref}
              apiKey={MOCK_API_KEY}
              autoStartAgent={autoStartAgent}
            />
            <button onClick={() => setAutoStartAgent(true)}>Start</button>
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      await act(async () => {
        getByText('Start').click();
      });

      // Should not throw errors even though agent is not configured
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not attempt to connect if not configured
      expect(mockAgentManager.connect).not.toHaveBeenCalled();
    });
  });
});
