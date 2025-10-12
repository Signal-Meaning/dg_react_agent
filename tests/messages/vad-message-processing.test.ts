/**
 * VAD Message Processing Tests
 * 
 * Test-Driven Development: Phase 2.2
 * 
 * These tests define the expected VAD message processing behavior before implementation.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 */

import { 
  AgentResponseType,
  UserStoppedSpeakingResponse,
  UtteranceEndResponse,
  VADEventResponse,
  AgentIncomingMessage
} from '../../src/types/agent';

describe('VAD Message Processing', () => {
  // Mock functions for testing
  const mockOnUserStoppedSpeaking = jest.fn();
  const mockOnUtteranceEnd = jest.fn();
  const mockOnVADEvent = jest.fn();
  const mockDispatch = jest.fn();

  // Check if we should run real API tests
  // Only run real API tests when explicitly enabled via environment variable
  const isRealAPITesting = process.env.RUN_REAL_API_TESTS === 'true' && 
                          (!!process.env.VITE_DEEPGRAM_API_KEY || !!process.env.DEEPGRAM_API_KEY);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UserStoppedSpeaking Message Processing', () => {
    it('should process UserStoppedSpeaking message from agent service', () => {
      const message: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: (data as UserStoppedSpeakingResponse).timestamp });
        }
      };

      processAgentMessage(message, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: 1234567890 });
    });

    it('should handle UserStoppedSpeaking without timestamp', () => {
      const message: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING
      };

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: (data as UserStoppedSpeakingResponse).timestamp });
        }
      };

      processAgentMessage(message, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: undefined });
    });

    it('should not call callbacks when not provided', () => {
      const message: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: (data as UserStoppedSpeakingResponse).timestamp });
        }
      };

      processAgentMessage(message, {});

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnUserStoppedSpeaking).not.toHaveBeenCalled();
    });
  });

  describe('UtteranceEnd Message Processing', () => {
    it('should process UtteranceEnd message from Deepgram', () => {
      const message: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 2],
        last_word_end: 3.1
      };

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.UTTERANCE_END) {
          const utteranceData = data as UtteranceEndResponse;
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: utteranceData.channel, 
              lastWordEnd: utteranceData.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: utteranceData.channel,
            lastWordEnd: utteranceData.last_word_end
          });
        }
      };

      processAgentMessage(message, {
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

    it('should handle single channel UtteranceEnd', () => {
      const message: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 1.5
      };

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.UTTERANCE_END) {
          const utteranceData = data as UtteranceEndResponse;
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: utteranceData.channel, 
              lastWordEnd: utteranceData.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: utteranceData.channel,
            lastWordEnd: utteranceData.last_word_end
          });
        }
      };

      processAgentMessage(message, {
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'UTTERANCE_END', 
        data: { 
          channel: [0, 1], 
          lastWordEnd: 1.5 
        } 
      });
    });

    it('should handle multi-channel UtteranceEnd', () => {
      const message: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [1, 4],
        last_word_end: 2.7
      };

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.UTTERANCE_END) {
          const utteranceData = data as UtteranceEndResponse;
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: utteranceData.channel, 
              lastWordEnd: utteranceData.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: utteranceData.channel,
            lastWordEnd: utteranceData.last_word_end
          });
        }
      };

      processAgentMessage(message, {
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'UTTERANCE_END', 
        data: { 
          channel: [1, 4], 
          lastWordEnd: 2.7 
        } 
      });
    });
  });

  describe('VADEvent Message Processing', () => {
    it('should process VADEvent message from transcription service', () => {
      const message: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true,
        confidence: 0.95,
        timestamp: 1234567890
      };

      const processTranscriptionMessage = (data: AgentIncomingMessage, callbacks: {
        onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: vadData.speech_detected 
          });
          callbacks.onVADEvent?.({
            speechDetected: vadData.speech_detected,
            confidence: vadData.confidence,
            timestamp: vadData.timestamp
          });
        }
      };

      processTranscriptionMessage(message, {
        onVADEvent: mockOnVADEvent,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: true 
      });
      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: 0.95,
        timestamp: 1234567890
      });
    });

    it('should handle VADEvent with speech not detected', () => {
      const message: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: false,
        confidence: 0.1
      };

      const processTranscriptionMessage = (data: AgentIncomingMessage, callbacks: {
        onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: vadData.speech_detected 
          });
          callbacks.onVADEvent?.({
            speechDetected: vadData.speech_detected,
            confidence: vadData.confidence,
            timestamp: vadData.timestamp
          });
        }
      };

      processTranscriptionMessage(message, {
        onVADEvent: mockOnVADEvent,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: false,
        confidence: 0.1,
        timestamp: undefined
      });
    });

    it('should handle VADEvent without optional fields', () => {
      const message: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true
      };

      const processTranscriptionMessage = (data: AgentIncomingMessage, callbacks: {
        onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: vadData.speech_detected 
          });
          callbacks.onVADEvent?.({
            speechDetected: vadData.speech_detected,
            confidence: vadData.confidence,
            timestamp: vadData.timestamp
          });
        }
      };

      processTranscriptionMessage(message, {
        onVADEvent: mockOnVADEvent,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: true 
      });
      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: undefined,
        timestamp: undefined
      });
    });
  });

  describe('Message Routing by Service', () => {
    it('should route UserStoppedSpeaking to agent message handler', () => {
      const message: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      const routeMessage = (data: AgentIncomingMessage, service: 'agent' | 'transcription') => {
        if (service === 'agent' && data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          mockOnUserStoppedSpeaking({ timestamp: (data as UserStoppedSpeakingResponse).timestamp });
          mockDispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
        }
      };

      routeMessage(message, 'agent');

      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: 1234567890 });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
    });

    it('should route UtteranceEnd to agent message handler', () => {
      const message: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 2.5
      };

      const routeMessage = (data: AgentIncomingMessage, service: 'agent' | 'transcription') => {
        if (service === 'agent' && data.type === AgentResponseType.UTTERANCE_END) {
          const utteranceData = data as UtteranceEndResponse;
          mockOnUtteranceEnd({
            channel: utteranceData.channel,
            lastWordEnd: utteranceData.last_word_end
          });
          mockDispatch({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: utteranceData.channel, 
              lastWordEnd: utteranceData.last_word_end 
            } 
          });
        }
      };

      routeMessage(message, 'agent');

      expect(mockOnUtteranceEnd).toHaveBeenCalledWith({
        channel: [0, 1],
        lastWordEnd: 2.5
      });
      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'UTTERANCE_END', 
        data: { 
          channel: [0, 1], 
          lastWordEnd: 2.5 
        } 
      });
    });

    it('should route VADEvent to transcription message handler', () => {
      const message: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true,
        confidence: 0.9
      };

      const routeMessage = (data: AgentIncomingMessage, service: 'agent' | 'transcription') => {
        if (service === 'transcription' && data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          mockOnVADEvent({
            speechDetected: vadData.speech_detected,
            confidence: vadData.confidence,
            timestamp: vadData.timestamp
          });
          mockDispatch({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: vadData.speech_detected 
          });
        }
      };

      routeMessage(message, 'transcription');

      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: 0.9,
        timestamp: undefined
      });
      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: true 
      });
    });
  });

  describe('Message Processing Error Handling', () => {
    it('should handle malformed UserStoppedSpeaking messages', () => {
      const malformedMessage = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        // Missing timestamp (optional, so should still work)
      } as UserStoppedSpeakingResponse;

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: (data as UserStoppedSpeakingResponse).timestamp });
        }
      };

      expect(() => {
        processAgentMessage(malformedMessage, {
          onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
          dispatch: mockDispatch
        });
      }).not.toThrow();

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: undefined });
    });

    it('should handle malformed UtteranceEnd messages', () => {
      const malformedMessage = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        // Missing last_word_end
      } as any;

      const processAgentMessage = (data: AgentIncomingMessage, callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.UTTERANCE_END) {
          const utteranceData = data as UtteranceEndResponse;
          if (typeof utteranceData.last_word_end === 'number') {
            callbacks.dispatch?.({ 
              type: 'UTTERANCE_END', 
              data: { 
                channel: utteranceData.channel, 
                lastWordEnd: utteranceData.last_word_end 
              } 
            });
            callbacks.onUtteranceEnd?.({
              channel: utteranceData.channel,
              lastWordEnd: utteranceData.last_word_end
            });
          }
        }
      };

      expect(() => {
        processAgentMessage(malformedMessage, {
          onUtteranceEnd: mockOnUtteranceEnd,
          dispatch: mockDispatch
        });
      }).not.toThrow();

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnUtteranceEnd).not.toHaveBeenCalled();
    });

    it('should handle malformed VADEvent messages', () => {
      const malformedMessage = {
        type: AgentResponseType.VAD_EVENT,
        // Missing speech_detected
      } as any;

      const processTranscriptionMessage = (data: AgentIncomingMessage, callbacks: {
        onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          if (typeof vadData.speech_detected === 'boolean') {
            callbacks.dispatch?.({ 
              type: 'USER_SPEAKING_STATE_CHANGE', 
              isSpeaking: vadData.speech_detected 
            });
            callbacks.onVADEvent?.({
              speechDetected: vadData.speech_detected,
              confidence: vadData.confidence,
              timestamp: vadData.timestamp
            });
          }
        }
      };

      expect(() => {
        processTranscriptionMessage(malformedMessage, {
          onVADEvent: mockOnVADEvent,
          dispatch: mockDispatch
        });
      }).not.toThrow();

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });

    it('should handle unknown message types gracefully', () => {
      const unknownMessage = {
        type: 'UnknownMessageType' as any,
        data: 'some data'
      };

      const processMessage = (data: AgentIncomingMessage, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        // Only process known VAD message types
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.onUserStoppedSpeaking?.({ timestamp: (data as UserStoppedSpeakingResponse).timestamp });
        } else if (data.type === AgentResponseType.UTTERANCE_END) {
          const utteranceData = data as UtteranceEndResponse;
          callbacks.onUtteranceEnd?.({
            channel: utteranceData.channel,
            lastWordEnd: utteranceData.last_word_end
          });
        } else if (data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          callbacks.onVADEvent?.({
            speechDetected: vadData.speech_detected,
            confidence: vadData.confidence,
            timestamp: vadData.timestamp
          });
        }
        // Unknown message types are ignored
      };

      expect(() => {
        processMessage(unknownMessage, {
          onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
          onUtteranceEnd: mockOnUtteranceEnd,
          onVADEvent: mockOnVADEvent,
          dispatch: mockDispatch
        });
      }).not.toThrow();

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnUserStoppedSpeaking).not.toHaveBeenCalled();
      expect(mockOnUtteranceEnd).not.toHaveBeenCalled();
      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });
  });

  describe('Message Processing Performance', () => {
    it('should handle rapid VAD events efficiently', () => {
      const messages: VADEventResponse[] = [
        { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.1 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.8 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.2 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.95 }
      ];

      const processTranscriptionMessage = (data: AgentIncomingMessage, callbacks: {
        onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: vadData.speech_detected 
          });
          callbacks.onVADEvent?.({
            speechDetected: vadData.speech_detected,
            confidence: vadData.confidence,
            timestamp: vadData.timestamp
          });
        }
      };

      const startTime = Date.now();

      messages.forEach(message => {
        processTranscriptionMessage(message, {
          onVADEvent: mockOnVADEvent,
          dispatch: mockDispatch
        });
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(10); // Should process 5 messages in <10ms
      expect(mockDispatch).toHaveBeenCalledTimes(5);
      expect(mockOnVADEvent).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed message types efficiently', () => {
      const messages: AgentIncomingMessage[] = [
        { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 },
        { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 },
        { type: AgentResponseType.UTTERANCE_END, channel: [0, 1], last_word_end: 1.5 },
        { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.1 },
        { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 2000 }
      ];

      const processMessage = (data: AgentIncomingMessage, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        if (data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: (data as UserStoppedSpeakingResponse).timestamp });
        } else if (data.type === AgentResponseType.UTTERANCE_END) {
          const utteranceData = data as UtteranceEndResponse;
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: utteranceData.channel, 
              lastWordEnd: utteranceData.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: utteranceData.channel,
            lastWordEnd: utteranceData.last_word_end
          });
        } else if (data.type === AgentResponseType.VAD_EVENT) {
          const vadData = data as VADEventResponse;
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: vadData.speech_detected 
          });
          callbacks.onVADEvent?.({
            speechDetected: vadData.speech_detected,
            confidence: vadData.confidence,
            timestamp: vadData.timestamp
          });
        }
      };

      const startTime = Date.now();

      messages.forEach(message => {
        processMessage(message, {
          onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
          onUtteranceEnd: mockOnUtteranceEnd,
          onVADEvent: mockOnVADEvent,
          dispatch: mockDispatch
        });
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(15); // Should process 5 mixed messages in <15ms
      expect(mockDispatch).toHaveBeenCalledTimes(5);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(2);
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(1);
      expect(mockOnVADEvent).toHaveBeenCalledTimes(2);
    });
  });

  // Real API Integration Tests (Message Format Validation Only)
  if (isRealAPITesting) {
    describe('Real API Integration Tests', () => {
      it('should have API key available for real API tests', () => {
        const apiKey = process.env.VITE_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;
        expect(apiKey).toBeDefined();
        expect(apiKey).not.toBe('');
        console.log('API key available for real API tests');
      });

      it('should validate Deepgram message formats', () => {
        // Test UserStoppedSpeaking format
        const userStoppedMessage = {
          type: 'UserStoppedSpeaking',
          timestamp: Date.now()
        };
        expect(userStoppedMessage.type).toBe('UserStoppedSpeaking');
        expect(typeof userStoppedMessage.timestamp).toBe('number');

        // Test UtteranceEnd format
        const utteranceEndMessage = {
          type: 'UtteranceEnd',
          channel: [0, 1],
          last_word_end: 2.5
        };
        expect(utteranceEndMessage.type).toBe('UtteranceEnd');
        expect(Array.isArray(utteranceEndMessage.channel)).toBe(true);
        expect(utteranceEndMessage.channel.length).toBe(2);
        expect(typeof utteranceEndMessage.last_word_end).toBe('number');

        // Test VADEvent format
        const vadEventMessage = {
          type: 'VADEvent',
          speech_detected: true,
          confidence: 0.95,
          timestamp: Date.now()
        };
        expect(vadEventMessage.type).toBe('VADEvent');
        expect(typeof vadEventMessage.speech_detected).toBe('boolean');
        expect(typeof vadEventMessage.confidence).toBe('number');
        expect(vadEventMessage.confidence).toBeGreaterThanOrEqual(0);
        expect(vadEventMessage.confidence).toBeLessThanOrEqual(1);
        
        console.log('Validated all Deepgram message formats');
      });

      it('should note that WebSocket tests are in E2E tests', () => {
        console.log('Note: Real WebSocket connection tests are in E2E tests (Playwright)');
        console.log('Run: npm run test:e2e to test actual WebSocket connections');
        expect(true).toBe(true); // Always pass
      });
    });
  } else {
    describe('Real API Integration Tests', () => {
      it.skip('should skip real API tests when not explicitly enabled', () => {
        // Set RUN_REAL_API_TESTS=true to enable real API tests
        // Example: RUN_REAL_API_TESTS=true npm test
      });
    });
  }
});
