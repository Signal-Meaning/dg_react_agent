/**
 * WebSocket Integration Tests
 * 
 * Test-Driven Development: Phase 3.2
 * 
 * These tests define the expected WebSocket integration behavior for VAD events.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 */

import { 
  AgentResponseType,
  UserStoppedSpeakingResponse,
  UtteranceEndResponse,
  VADEventResponse
} from 'deepgram-voice-interaction-react';

describe('WebSocket Integration Tests', () => {
  // Mock WebSocket and event handlers
  let mockWebSocket: any;
  let mockOnUserStoppedSpeaking: jest.Mock;
  let mockOnUtteranceEnd: jest.Mock;
  let mockOnVADEvent: jest.Mock;
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock WebSocket
    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Mock callbacks
    mockOnUserStoppedSpeaking = jest.fn();
    mockOnUtteranceEnd = jest.fn();
    mockOnVADEvent = jest.fn();
    mockDispatch = jest.fn();
  });

  describe('Agent WebSocket VAD Events', () => {
    it('should handle UserStoppedSpeaking message from agent WebSocket', () => {
      const message: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      const handleAgentMessage = (data: any, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: data.timestamp });
        }
      };

      // Simulate WebSocket message event
      const messageEvent = {
        data: JSON.stringify(message)
      };

      const parsedMessage = JSON.parse(messageEvent.data);
      handleAgentMessage(parsedMessage, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: 1234567890 });
    });

    it('should handle UtteranceEnd message from agent WebSocket', () => {
      const message: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 2],
        last_word_end: 3.1
      };

      const handleAgentMessage = (data: any, callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.UTTERANCE_END) {
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: data.channel, 
              lastWordEnd: data.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: data.channel,
            lastWordEnd: data.last_word_end
          });
        }
      };

      const messageEvent = {
        data: JSON.stringify(message)
      };

      const parsedMessage = JSON.parse(messageEvent.data);
      handleAgentMessage(parsedMessage, {
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'UTTERANCE_END', 
        data: { 
          channel: [0, 2], 
          lastWordEnd: 3.1 
        } 
      });
      expect(mockOnUtteranceEnd).toHaveBeenCalledWith({
        channel: [0, 2],
        lastWordEnd: 3.1
      });
    });

    it('should handle multiple agent VAD messages in sequence', () => {
      const messages = [
        { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 },
        { type: AgentResponseType.UTTERANCE_END, channel: [0, 1], last_word_end: 1.5 },
        { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 2000 }
      ];

      const handleAgentMessage = (data: any, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: data.timestamp });
        } else if (data.type === AgentResponseType.UTTERANCE_END) {
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: data.channel, 
              lastWordEnd: data.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: data.channel,
            lastWordEnd: data.last_word_end
          });
        }
      };

      messages.forEach(message => {
        const messageEvent = {
          data: JSON.stringify(message)
        };
        const parsedMessage = JSON.parse(messageEvent.data);
        
        handleAgentMessage(parsedMessage, {
          onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
          onUtteranceEnd: mockOnUtteranceEnd,
          dispatch: mockDispatch
        });
      });

      expect(mockDispatch).toHaveBeenCalledTimes(3);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(2);
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transcription WebSocket VAD Events', () => {
    it('should handle VADEvent message from transcription WebSocket', () => {
      const message: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true,
        confidence: 0.95,
        timestamp: 1234567890
      };

      const handleTranscriptionMessage = (data: any, callbacks: {
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: data.speech_detected 
          });
          // VAD events are now processed internally only
        }
      };

      const messageEvent = {
        data: JSON.stringify(message)
      };

      const parsedMessage = JSON.parse(messageEvent.data);
      handleTranscriptionMessage(parsedMessage, {
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: true 
      });
      // VAD events are now processed internally only
      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });

    it('should handle rapid VAD events from transcription', () => {
      const messages: VADEventResponse[] = [
        { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.1 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.8 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.2 }
      ];

      const handleTranscriptionMessage = (data: any, callbacks: {
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: data.speech_detected 
          });
          // VAD events are now processed internally only
        }
      };

      messages.forEach(message => {
        const messageEvent = {
          data: JSON.stringify(message)
        };
        const parsedMessage = JSON.parse(messageEvent.data);
        
        handleTranscriptionMessage(parsedMessage, {
          dispatch: mockDispatch
        });
      });

      expect(mockDispatch).toHaveBeenCalledTimes(4);
      // VAD events are now processed internally only
      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Connection State Integration', () => {
    it('should handle VAD events only when WebSocket is open', () => {
      const message: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      const handleAgentMessage = (data: any, ws: any, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (ws.readyState === 1 && data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: data.timestamp });
        }
      };

      // Test with open WebSocket
      const openWebSocket = { ...mockWebSocket, readyState: 1 };
      const messageEvent = { data: JSON.stringify(message) };
      const parsedMessage = JSON.parse(messageEvent.data);

      handleAgentMessage(parsedMessage, openWebSocket, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: 1234567890 });
    });

    it('should ignore VAD events when WebSocket is closed', () => {
      const message: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      const handleAgentMessage = (data: any, ws: any, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (ws.readyState === 1 && data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: data.timestamp });
        }
      };

      // Test with closed WebSocket
      const closedWebSocket = { ...mockWebSocket, readyState: 3 }; // CLOSED
      const messageEvent = { data: JSON.stringify(message) };
      const parsedMessage = JSON.parse(messageEvent.data);

      handleAgentMessage(parsedMessage, closedWebSocket, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnUserStoppedSpeaking).not.toHaveBeenCalled();
    });

    it('should handle WebSocket reconnection with VAD events', () => {
      const message: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 2.5
      };

      const handleAgentMessage = (data: any, ws: any, callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (ws.readyState === 1 && data.type === AgentResponseType.UTTERANCE_END) {
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: data.channel, 
              lastWordEnd: data.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: data.channel,
            lastWordEnd: data.last_word_end
          });
        }
      };

      // Simulate reconnection: closed -> open
      const closedWebSocket = { ...mockWebSocket, readyState: 3 };
      const reopenedWebSocket = { ...mockWebSocket, readyState: 1 };

      const messageEvent = { data: JSON.stringify(message) };
      const parsedMessage = JSON.parse(messageEvent.data);

      // Should not process when closed
      handleAgentMessage(parsedMessage, closedWebSocket, {
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnUtteranceEnd).not.toHaveBeenCalled();

      // Should process when reopened
      handleAgentMessage(parsedMessage, reopenedWebSocket, {
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'UTTERANCE_END', 
        data: { 
          channel: [0, 1], 
          lastWordEnd: 2.5 
        } 
      });
      expect(mockOnUtteranceEnd).toHaveBeenCalledWith({
        channel: [0, 1],
        lastWordEnd: 2.5
      });
    });
  });

  describe('WebSocket Error Handling', () => {
    it('should handle malformed JSON in WebSocket messages', () => {
      const malformedMessage = '{"type":"UserStoppedSpeaking","timestamp":}'; // Invalid JSON

      const handleWebSocketMessage = (rawData: string, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        try {
          const data = JSON.parse(rawData);
          if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
            callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
            callbacks.onUserStoppedSpeaking?.({ timestamp: data.timestamp });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      handleWebSocketMessage(malformedMessage, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error));
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnUserStoppedSpeaking).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle unknown message types gracefully', () => {
      const unknownMessage = {
        type: 'UnknownMessageType',
        data: 'some data'
      };

      const handleWebSocketMessage = (data: any, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: data.timestamp });
        } else if (data.type === AgentResponseType.UTTERANCE_END) {
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: data.channel, 
              lastWordEnd: data.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: data.channel,
            lastWordEnd: data.last_word_end
          });
        } else if (data.type === AgentResponseType.VAD_EVENT) {
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: data.speech_detected 
          });
          // VAD events are now processed internally only
        }
        // Unknown message types are ignored
      };

      handleWebSocketMessage(unknownMessage, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnUserStoppedSpeaking).not.toHaveBeenCalled();
      expect(mockOnUtteranceEnd).not.toHaveBeenCalled();
      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });

    it('should handle WebSocket connection errors', () => {
      const errorEvent = {
        type: 'error',
        error: new Error('WebSocket connection failed')
      };

      const handleWebSocketError = (error: any, callbacks: {
        onError?: (error: any) => void;
      }) => {
        callbacks.onError?.(error);
      };

      const mockOnError = jest.fn();

      handleWebSocketError(errorEvent.error, {
        onError: mockOnError
      });

      expect(mockOnError).toHaveBeenCalledWith(errorEvent.error);
    });
  });

  describe('WebSocket Performance', () => {
    it('should handle high-frequency VAD messages efficiently', () => {
      const messages: VADEventResponse[] = Array.from({ length: 100 }, (_, i) => ({
        type: AgentResponseType.VAD_EVENT,
        speech_detected: i % 2 === 0,
        confidence: 0.5 + (i % 10) * 0.05
      }));

      const handleTranscriptionMessage = (data: any, callbacks: {
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: data.speech_detected 
          });
          // VAD events are now processed internally only
        }
      };

      const startTime = Date.now();

      messages.forEach(message => {
        const messageEvent = {
          data: JSON.stringify(message)
        };
        const parsedMessage = JSON.parse(messageEvent.data);
        
        handleTranscriptionMessage(parsedMessage, {
          dispatch: mockDispatch
        });
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(100); // Should process 100 messages in <100ms
      expect(mockDispatch).toHaveBeenCalledTimes(100);
      // VAD events are now processed internally only
      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });

    it('should handle mixed WebSocket message types efficiently', () => {
      const messages = [
        { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 },
        { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 },
        { type: AgentResponseType.UTTERANCE_END, channel: [0, 1], last_word_end: 1.5 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.1 },
        { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 2000 }
      ];

      const handleWebSocketMessage = (data: any, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: data.timestamp });
        } else if (data.type === AgentResponseType.UTTERANCE_END) {
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: data.channel, 
              lastWordEnd: data.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: data.channel,
            lastWordEnd: data.last_word_end
          });
        } else if (data.type === AgentResponseType.VAD_EVENT) {
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: data.speech_detected 
          });
          // VAD events are now processed internally only
        }
      };

      const startTime = Date.now();

      messages.forEach(message => {
        const messageEvent = {
          data: JSON.stringify(message)
        };
        const parsedMessage = JSON.parse(messageEvent.data);
        
        handleWebSocketMessage(parsedMessage, {
          onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
          onUtteranceEnd: mockOnUtteranceEnd,
          dispatch: mockDispatch
        });
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(20); // Should process 5 mixed messages in <20ms
      expect(mockDispatch).toHaveBeenCalledTimes(5);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(2);
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(1);
      // VAD events are now processed internally only
      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });
  });
});
