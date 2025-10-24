/**
 * Dual-Mode VAD Tests
 * 
 * Test-Driven Development: Phase 3.3
 * 
 * These tests define the expected dual-mode VAD behavior where both transcription
 * and agent services provide VAD events that work together.
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

describe('Dual-Mode VAD Tests', () => {
  // Mock functions for testing
  let mockOnUserStoppedSpeaking: jest.Mock;
  let mockOnUtteranceEnd: jest.Mock;
  let mockOnVADEvent: jest.Mock;
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOnUserStoppedSpeaking = jest.fn();
    mockOnUtteranceEnd = jest.fn();
    mockOnVADEvent = jest.fn();
    mockDispatch = jest.fn();
  });

  describe('Transcription + Agent VAD Coordination', () => {
    it('should coordinate VADEvent from transcription with UserStoppedSpeaking from agent', () => {
      const transcriptionMessage: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: false,
        confidence: 0.1
      };

      const agentMessage: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };

      const handleDualModeVAD = (transcriptionData: any, agentData: any, callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        // Handle transcription VAD event
        if (transcriptionData.type === AgentResponseType.VAD_EVENT) {
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: transcriptionData.speech_detected 
          });
          // VAD events are now processed internally only
        }

        // Handle agent confirmation
        if (agentData.type === AgentResponseType.USER_STOPPED_SPEAKING) {
          callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
          callbacks.onUserStoppedSpeaking?.({ timestamp: agentData.timestamp });
        }
      };

      handleDualModeVAD(transcriptionMessage, agentMessage, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: false,
        confidence: 0.1,
        timestamp: undefined
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: 1234567890 });
    });

    it('should coordinate VADEvent from transcription with UtteranceEnd from agent', () => {
      const transcriptionMessage: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true,
        confidence: 0.9
      };

      const agentMessage: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 2.5
      };

      const handleDualModeVAD = (transcriptionData: any, agentData: any, callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        // Handle transcription VAD event
        if (transcriptionData.type === AgentResponseType.VAD_EVENT) {
          callbacks.dispatch?.({ 
            type: 'USER_SPEAKING_STATE_CHANGE', 
            isSpeaking: transcriptionData.speech_detected 
          });
          // VAD events are now processed internally only
        }

        // Handle agent UtteranceEnd
        if (agentData.type === AgentResponseType.UTTERANCE_END) {
          callbacks.dispatch?.({ 
            type: 'UTTERANCE_END', 
            data: { 
              channel: agentData.channel, 
              lastWordEnd: agentData.last_word_end 
            } 
          });
          callbacks.onUtteranceEnd?.({
            channel: agentData.channel,
            lastWordEnd: agentData.last_word_end
          });
        }
      };

      handleDualModeVAD(transcriptionMessage, agentMessage, {
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: 0.9,
        timestamp: undefined
      });
      expect(mockOnUtteranceEnd).toHaveBeenCalledWith({
        channel: [0, 1],
        lastWordEnd: 2.5
      });
    });
  });

  describe('VAD Event Timing and Sequencing', () => {
    it('should handle VAD events in correct sequence: start -> speaking -> end', () => {
      const events = [
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 } },
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.8 } },
        { service: 'agent', data: { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 } },
        { service: 'agent', data: { type: AgentResponseType.UTTERANCE_END, channel: [0, 1], last_word_end: 1.5 } }
      ];

      const handleSequentialVADEvents = (events: any[], callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        events.forEach(event => {
          if (event.service === 'transcription' && event.data.type === AgentResponseType.VAD_EVENT) {
            callbacks.dispatch?.({ 
              type: 'USER_SPEAKING_STATE_CHANGE', 
              isSpeaking: event.data.speech_detected 
            });
            // VAD events are now processed internally only
              speechDetected: event.data.speech_detected,
              confidence: event.data.confidence,
              timestamp: event.data.timestamp
            });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
            callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
            callbacks.onUserStoppedSpeaking?.({ timestamp: event.data.timestamp });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.UTTERANCE_END) {
            callbacks.dispatch?.({ 
              type: 'UTTERANCE_END', 
              data: { 
                channel: event.data.channel, 
                lastWordEnd: event.data.last_word_end 
              } 
            });
            callbacks.onUtteranceEnd?.({
              channel: event.data.channel,
              lastWordEnd: event.data.last_word_end
            });
          }
        });
      };

      handleSequentialVADEvents(events, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledTimes(4);
      expect(mockOnVADEvent).toHaveBeenCalledTimes(2);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(1);
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(1);
    });

    it('should handle overlapping VAD events from different services', () => {
      const overlappingEvents = [
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 } },
        { service: 'agent', data: { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 } },
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.1 } },
        { service: 'agent', data: { type: AgentResponseType.UTTERANCE_END, channel: [0, 1], last_word_end: 1.0 } }
      ];

      const handleOverlappingVADEvents = (events: any[], callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        events.forEach(event => {
          if (event.service === 'transcription' && event.data.type === AgentResponseType.VAD_EVENT) {
            callbacks.dispatch?.({ 
              type: 'USER_SPEAKING_STATE_CHANGE', 
              isSpeaking: event.data.speech_detected 
            });
            // VAD events are now processed internally only
              speechDetected: event.data.speech_detected,
              confidence: event.data.confidence,
              timestamp: event.data.timestamp
            });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
            callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
            callbacks.onUserStoppedSpeaking?.({ timestamp: event.data.timestamp });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.UTTERANCE_END) {
            callbacks.dispatch?.({ 
              type: 'UTTERANCE_END', 
              data: { 
                channel: event.data.channel, 
                lastWordEnd: event.data.last_word_end 
              } 
            });
            callbacks.onUtteranceEnd?.({
              channel: event.data.channel,
              lastWordEnd: event.data.last_word_end
            });
          }
        });
      };

      handleOverlappingVADEvents(overlappingEvents, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledTimes(4);
      expect(mockOnVADEvent).toHaveBeenCalledTimes(2);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(1);
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('VAD Event Conflict Resolution', () => {
    it('should resolve conflicts when transcription and agent disagree', () => {
      const conflictingEvents = [
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 } },
        { service: 'agent', data: { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 } }
      ];

      const handleConflictingVADEvents = (events: any[], callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        // Agent events take precedence for final state
        let finalSpeakingState = false;
        
        events.forEach(event => {
          if (event.service === 'transcription' && event.data.type === AgentResponseType.VAD_EVENT) {
            // VAD events are now processed internally only
              speechDetected: event.data.speech_detected,
              confidence: event.data.confidence,
              timestamp: event.data.timestamp
            });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
            finalSpeakingState = false;
            callbacks.onUserStoppedSpeaking?.({ timestamp: event.data.timestamp });
          }
        });

        // Dispatch final state
        callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: finalSpeakingState });
      };

      handleConflictingVADEvents(conflictingEvents, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledWith({ 
        type: 'USER_SPEAKING_STATE_CHANGE', 
        isSpeaking: false 
      });
      expect(mockOnVADEvent).toHaveBeenCalledWith({
        speechDetected: true,
        confidence: 0.9,
        timestamp: undefined
      });
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledWith({ timestamp: 1000 });
    });

    it('should prioritize UtteranceEnd over VADEvent for end-of-speech detection', () => {
      const priorityEvents = [
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 } },
        { service: 'agent', data: { type: AgentResponseType.UTTERANCE_END, channel: [0, 1], last_word_end: 1.5 } },
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.1 } }
      ];

      const handlePriorityVADEvents = (events: any[], callbacks: {
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        let hasUtteranceEnd = false;
        
        events.forEach(event => {
          if (event.service === 'agent' && event.data.type === AgentResponseType.UTTERANCE_END) {
            hasUtteranceEnd = true;
            callbacks.dispatch?.({ 
              type: 'UTTERANCE_END', 
              data: { 
                channel: event.data.channel, 
                lastWordEnd: event.data.last_word_end 
              } 
            });
            callbacks.onUtteranceEnd?.({
              channel: event.data.channel,
              lastWordEnd: event.data.last_word_end
            });
          } else if (event.service === 'transcription' && event.data.type === AgentResponseType.VAD_EVENT && !hasUtteranceEnd) {
            callbacks.dispatch?.({ 
              type: 'USER_SPEAKING_STATE_CHANGE', 
              isSpeaking: event.data.speech_detected 
            });
            // VAD events are now processed internally only
              speechDetected: event.data.speech_detected,
              confidence: event.data.confidence,
              timestamp: event.data.timestamp
            });
          }
        });
      };

      handlePriorityVADEvents(priorityEvents, {
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledTimes(2); // Only first VADEvent and UtteranceEnd
      expect(mockOnVADEvent).toHaveBeenCalledTimes(1); // Only first VADEvent
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('VAD Event State Synchronization', () => {
    it('should maintain consistent state across both services', () => {
      const stateSyncEvents = [
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 } },
        { service: 'agent', data: { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 } },
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: false, confidence: 0.1 } }
      ];

      const handleStateSyncVADEvents = (events: any[], callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        let currentSpeakingState = false;
        
        events.forEach(event => {
          if (event.service === 'transcription' && event.data.type === AgentResponseType.VAD_EVENT) {
            currentSpeakingState = event.data.speech_detected;
            callbacks.dispatch?.({ 
              type: 'USER_SPEAKING_STATE_CHANGE', 
              isSpeaking: currentSpeakingState 
            });
            // VAD events are now processed internally only
              speechDetected: event.data.speech_detected,
              confidence: event.data.confidence,
              timestamp: event.data.timestamp
            });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
            currentSpeakingState = false;
            callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: currentSpeakingState });
            callbacks.onUserStoppedSpeaking?.({ timestamp: event.data.timestamp });
          }
        });
      };

      handleStateSyncVADEvents(stateSyncEvents, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledTimes(3);
      expect(mockOnVADEvent).toHaveBeenCalledTimes(2);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(1);
    });

    it('should handle service-specific VAD event filtering', () => {
      const mixedEvents = [
        { service: 'transcription', data: { type: AgentResponseType.VAD_EVENT, speech_detected: true, confidence: 0.9 } },
        { service: 'agent', data: { type: AgentResponseType.USER_STOPPED_SPEAKING, timestamp: 1000 } },
        { service: 'transcription', data: { type: 'Transcript', transcript: 'Hello world' } }, // Non-VAD event
        { service: 'agent', data: { type: AgentResponseType.UTTERANCE_END, channel: [0, 1], last_word_end: 1.5 } }
      ];

      const handleFilteredVADEvents = (events: any[], callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        events.forEach(event => {
          if (event.service === 'transcription' && event.data.type === AgentResponseType.VAD_EVENT) {
            callbacks.dispatch?.({ 
              type: 'USER_SPEAKING_STATE_CHANGE', 
              isSpeaking: event.data.speech_detected 
            });
            // VAD events are now processed internally only
              speechDetected: event.data.speech_detected,
              confidence: event.data.confidence,
              timestamp: event.data.timestamp
            });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
            callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
            callbacks.onUserStoppedSpeaking?.({ timestamp: event.data.timestamp });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.UTTERANCE_END) {
            callbacks.dispatch?.({ 
              type: 'UTTERANCE_END', 
              data: { 
                channel: event.data.channel, 
                lastWordEnd: event.data.last_word_end 
              } 
            });
            callbacks.onUtteranceEnd?.({
              channel: event.data.channel,
              lastWordEnd: event.data.last_word_end
            });
          }
          // Non-VAD events are ignored
        });
      };

      handleFilteredVADEvents(mixedEvents, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      expect(mockDispatch).toHaveBeenCalledTimes(3); // Only VAD events
      expect(mockOnVADEvent).toHaveBeenCalledTimes(1);
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(1);
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dual-Mode VAD Performance', () => {
    it('should handle high-frequency dual-mode VAD events efficiently', () => {
      const events = Array.from({ length: 100 }, (_, i) => {
        if (i % 3 === 0) {
          return { 
            service: 'transcription', 
            data: { 
              type: AgentResponseType.VAD_EVENT, 
              speech_detected: i % 2 === 0, 
              confidence: 0.5 + (i % 10) * 0.05 
            } 
          };
        } else if (i % 3 === 1) {
          return { 
            service: 'agent', 
            data: { 
              type: AgentResponseType.USER_STOPPED_SPEAKING, 
              timestamp: i * 1000 
            } 
          };
        } else {
          return { 
            service: 'agent', 
            data: { 
              type: AgentResponseType.UTTERANCE_END, 
              channel: [0, 1], 
              last_word_end: i * 0.1 
            } 
          };
        }
      });

      const handleHighFrequencyDualModeVAD = (events: any[], callbacks: {
        onUserStoppedSpeaking?: (data: { timestamp?: number }) => void;
        onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
        dispatch?: typeof mockDispatch;
      }) => {
        events.forEach(event => {
          if (event.service === 'transcription' && event.data.type === AgentResponseType.VAD_EVENT) {
            callbacks.dispatch?.({ 
              type: 'USER_SPEAKING_STATE_CHANGE', 
              isSpeaking: event.data.speech_detected 
            });
            // VAD events are now processed internally only
              speechDetected: event.data.speech_detected,
              confidence: event.data.confidence,
              timestamp: event.data.timestamp
            });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.USER_STOPPED_SPEAKING) {
            callbacks.dispatch?.({ type: 'USER_SPEAKING_STATE_CHANGE', isSpeaking: false });
            callbacks.onUserStoppedSpeaking?.({ timestamp: event.data.timestamp });
          } else if (event.service === 'agent' && event.data.type === AgentResponseType.UTTERANCE_END) {
            callbacks.dispatch?.({ 
              type: 'UTTERANCE_END', 
              data: { 
                channel: event.data.channel, 
                lastWordEnd: event.data.last_word_end 
              } 
            });
            callbacks.onUtteranceEnd?.({
              channel: event.data.channel,
              lastWordEnd: event.data.last_word_end
            });
          }
        });
      };

      const startTime = Date.now();

      handleHighFrequencyDualModeVAD(events, {
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        onUtteranceEnd: mockOnUtteranceEnd,
        dispatch: mockDispatch
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(100); // Should process 100 events in <100ms
      expect(mockDispatch).toHaveBeenCalledTimes(100);
      expect(mockOnVADEvent).toHaveBeenCalledTimes(34); // ~1/3 of events
      expect(mockOnUserStoppedSpeaking).toHaveBeenCalledTimes(33); // ~1/3 of events
      expect(mockOnUtteranceEnd).toHaveBeenCalledTimes(33); // ~1/3 of events
    });
  });
});
