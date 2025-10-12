/**
 * VAD Event Handler Tests
 * 
 * Test-Driven Development: Phase 1.3
 * 
 * These tests define the expected VAD event handler behavior before implementation.
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
} from '../../src/types/agent';

describe('VAD Event Handlers', () => {
  // Mock functions for testing
  const mockOnUserStoppedSpeaking = jest.fn();
  const mockOnUtteranceEnd = jest.fn();
  const mockOnVADEvent = jest.fn();
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleUserStoppedSpeaking', () => {
    it('should call onUserStoppedSpeaking callback when provided', () => {
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      // This will be implemented in the actual handler
      const handleUserStoppedSpeaking = (data: UserStoppedSpeakingResponse) => {
        mockOnUserStoppedSpeaking(data);
      };

      handleUserStoppedSpeaking(response);

      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith(response);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(1);
    });

    it('should handle response without timestamp', () => {
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING
      };

      const handleUserStoppedSpeaking = (data: UserStoppedSpeakingResponse) => {
        mockOnUserStoppedSpeaking(data);
      };

      handleUserStoppedSpeaking(response);

      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith(response);
    });

    it('should not call callback when not provided', () => {
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING
      };

      const handleUserStoppedSpeaking = (data: UserStoppedSpeakingResponse, callback?: (data: UserStoppedSpeakingResponse) => void) => {
        if (callback) {
          callback(data);
        }
      };

      handleUserStoppedSpeaking(response);

      expect(mockOnUserStoppedSpeaking).not.toHaveBeenCalled();
    });
  });

  describe('handleUtteranceEnd', () => {
    it('should call onUtteranceEnd callback with correct data', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 2],
        last_word_end: 3.1
      };

      const handleUtteranceEnd = (data: UtteranceEndResponse) => {
        mockOnUtteranceEnd({
          channel: data.channel,
          lastWordEnd: data.last_word_end
        });
      };

      handleUtteranceEnd(response);

      expect(mockOnUtteranceEnd).toHaveBeenCalledWith({
        channel: [0, 2],
        lastWordEnd: 3.1
      });
    });

    it('should handle single channel audio', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 1.5
      };

      const handleUtteranceEnd = (data: UtteranceEndResponse) => {
        mockOnUtteranceEnd({
          channel: data.channel,
          lastWordEnd: data.last_word_end
        });
      };

      handleUtteranceEnd(response);

      expect(mockOnUtteranceEnd).toHaveBeenCalledWith({
        channel: [0, 1],
        lastWordEnd: 1.5
      });
    });

    it('should handle multi-channel audio', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [1, 4],
        last_word_end: 2.7
      };

      const handleUtteranceEnd = (data: UtteranceEndResponse) => {
        mockOnUtteranceEnd({
          channel: data.channel,
          lastWordEnd: data.last_word_end
        });
      };

      handleUtteranceEnd(response);

      expect(mockOnUtteranceEnd).toHaveBeenCalledWith({
        channel: [1, 4],
        lastWordEnd: 2.7
      });
    });

    it('should not call callback when not provided', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 1.5
      };

      const handleUtteranceEnd = (data: UtteranceEndResponse, callback?: (data: { channel: number[]; lastWordEnd: number }) => void) => {
        if (callback) {
          callback({
            channel: data.channel,
            lastWordEnd: data.last_word_end
          });
        }
      };

      handleUtteranceEnd(response);

      expect(mockOnUtteranceEnd).not.toHaveBeenCalled();
    });
  });

  describe('handleVADEvent', () => {
    it('should call onVADEvent callback with speech detected', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true,
        confidence: 0.95,
        timestamp: 1234567890
      };

      const handleVADEvent = (data: VADEventResponse) => {
        mockOnVADEvent({
          speechDetected: data.speech_detected,
          confidence: data.confidence,
          timestamp: data.timestamp
        });
      };

      handleVADEvent(response);

      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: 0.95,
        timestamp: 1234567890
      });
    });

    it('should handle speech not detected', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: false,
        confidence: 0.1
      };

      const handleVADEvent = (data: VADEventResponse) => {
        mockOnVADEvent({
          speechDetected: data.speech_detected,
          confidence: data.confidence,
          timestamp: data.timestamp
        });
      };

      handleVADEvent(response);

      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: false,
        confidence: 0.1,
        timestamp: undefined
      });
    });

    it('should handle response without optional fields', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true
      };

      const handleVADEvent = (data: VADEventResponse) => {
        mockOnVADEvent({
          speechDetected: data.speech_detected,
          confidence: data.confidence,
          timestamp: data.timestamp
        });
      };

      handleVADEvent(response);

      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: undefined,
        timestamp: undefined
      });
    });

    it('should not call callback when not provided', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true
      };

      const handleVADEvent = (data: VADEventResponse, callback?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void) => {
        if (callback) {
          callback({
            speechDetected: data.speech_detected,
            confidence: data.confidence,
            timestamp: data.timestamp
          });
        }
      };

      handleVADEvent(response);

      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });
  });

  describe('State Dispatch Integration', () => {
    it('should dispatch USER_SPEAKING_STATE_CHANGE for UserStoppedSpeaking', () => {
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING
      };

      const handleUserStoppedSpeaking = (data: UserStoppedSpeakingResponse, dispatch: typeof mockDispatch) => {
        dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
        mockOnUserStoppedSpeaking(data);
      };

      handleUserStoppedSpeaking(response, mockDispatch);

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith(response);
    });

    it('should dispatch UTTERANCE_END for UtteranceEnd', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 2.5
      };

      const handleUtteranceEnd = (data: UtteranceEndResponse, dispatch: typeof mockDispatch) => {
        dispatch({ 
          type: 'UTTERANCE_END', 
          data: { 
            channel: data.channel, 
            lastWordEnd: data.last_word_end 
          } 
        });
        mockOnUtteranceEnd({
          channel: data.channel,
          lastWordEnd: data.last_word_end
        });
      };

      handleUtteranceEnd(response, mockDispatch);

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

    it('should dispatch USER_SPEAKING_STATE_CHANGE for VADEvent', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true,
        confidence: 0.9
      };

      const handleVADEvent = (data: VADEventResponse, dispatch: typeof mockDispatch) => {
        dispatch({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: data.speech_detected });
        mockOnVADEvent({
          speechDetected: data.speech_detected,
          confidence: data.confidence,
          timestamp: data.timestamp
        });
      };

      handleVADEvent(response, mockDispatch);

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: true 
      });
      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: 0.9,
        timestamp: undefined
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed UserStoppedSpeaking response', () => {
      const malformedResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        // Missing timestamp (optional, so this should still work)
      } as UserStoppedSpeakingResponse;

      const handleUserStoppedSpeaking = (data: UserStoppedSpeakingResponse) => {
        mockOnUserStoppedSpeaking(data);
      };

      expect(() => {
        handleUserStoppedSpeaking(malformedResponse);
      }).not.toThrow();

      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith(malformedResponse);
    });

    it('should handle malformed UtteranceEnd response', () => {
      const malformedResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        // Missing last_word_end
      } as any;

      const handleUtteranceEnd = (data: UtteranceEndResponse) => {
        if (typeof data.last_word_end === 'number') {
          mockOnUtteranceEnd({
            channel: data.channel,
            lastWordEnd: data.last_word_end
          });
        }
      };

      expect(() => {
        handleUtteranceEnd(malformedResponse);
      }).not.toThrow();

      expect(mockOnUtteranceEnd).not.toHaveBeenCalled();
    });

    it('should handle malformed VADEvent response', () => {
      const malformedResponse = {
        type: AgentResponseType.VAD_EVENT,
        // Missing speech_detected
      } as any;

      const handleVADEvent = (data: VADEventResponse) => {
        if (typeof data.speech_detected === 'boolean') {
          mockOnVADEvent({
            speechDetected: data.speech_detected,
            confidence: data.confidence,
            timestamp: data.timestamp
          });
        }
      };

      expect(() => {
        handleVADEvent(malformedResponse);
      }).not.toThrow();

      expect(mockOnVADEvent).not.toHaveBeenCalled();
    });
  });

  describe('Callback Chaining', () => {
    it('should chain multiple callbacks for UserStoppedSpeaking', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING
      };

      const handleUserStoppedSpeaking = (data: UserStoppedSpeakingResponse, ...callbacks: Array<(data: UserStoppedSpeakingResponse) => void>) => {
        callbacks.forEach(callback => callback(data));
      };

      handleUserStoppedSpeaking(response, callback1, callback2);

      expect(callback1).toHaveBeenCalledWith(response);
      expect(callback2).toHaveBeenCalledWith(response);
    });

    it('should handle empty callback arrays', () => {
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING
      };

      const handleUserStoppedSpeaking = (data: UserStoppedSpeakingResponse, ...callbacks: Array<(data: UserStoppedSpeakingResponse) => void>) => {
        callbacks.forEach(callback => callback(data));
      };

      expect(() => {
        handleUserStoppedSpeaking(response);
      }).not.toThrow();
    });
  });
});
