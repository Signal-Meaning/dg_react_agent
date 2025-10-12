/**
 * VAD Event Type Definition Tests
 * 
 * Test-Driven Development: Phase 1.1
 * 
 * These tests define the expected VAD event types before implementation.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 */

import { 
  UserStoppedSpeakingResponse,
  UtteranceEndResponse,
  VADEventResponse,
  AgentResponseType 
} from '../../src/types/agent';

describe('VAD Event Type Definitions', () => {
  describe('UserStoppedSpeakingResponse', () => {
    it('should define UserStoppedSpeakingResponse type', () => {
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING,
        timestamp: 1234567890
      };
      
      expect(response.type).toBe('UserStoppedSpeaking');
      expect(response.timestamp).toBe(1234567890);
    });

    it('should allow optional timestamp', () => {
      const response: UserStoppedSpeakingResponse = {
        type: AgentResponseType.USER_STOPPED_SPEAKING
      };
      
      expect(response.type).toBe('UserStoppedSpeaking');
      expect(response.timestamp).toBeUndefined();
    });

    it('should match AgentResponseType enum', () => {
      expect(AgentResponseType.USER_STOPPED_SPEAKING).toBe('UserStoppedSpeaking');
    });
  });

  describe('UtteranceEndResponse', () => {
    it('should define UtteranceEndResponse with Deepgram structure', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 2],
        last_word_end: 3.1
      };
      
      expect(response.type).toBe('UtteranceEnd');
      expect(response.channel).toEqual([0, 2]);
      expect(response.last_word_end).toBe(3.1);
    });

    it('should handle single channel audio', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [0, 1],
        last_word_end: 1.5
      };
      
      expect(response.channel).toEqual([0, 1]);
    });

    it('should handle multi-channel audio', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [1, 4], // Channel 1 of 4 channels
        last_word_end: 2.7
      };
      
      expect(response.channel).toEqual([1, 4]);
    });

    it('should match AgentResponseType enum', () => {
      expect(AgentResponseType.UTTERANCE_END).toBe('UtteranceEnd');
    });
  });

  describe('VADEventResponse', () => {
    it('should define VADEventResponse type', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: true,
        confidence: 0.95,
        timestamp: 1234567890
      };
      
      expect(response.type).toBe('VADEvent');
      expect(response.speech_detected).toBe(true);
      expect(response.confidence).toBe(0.95);
      expect(response.timestamp).toBe(1234567890);
    });

    it('should allow optional confidence and timestamp', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: false
      };
      
      expect(response.speech_detected).toBe(false);
      expect(response.confidence).toBeUndefined();
      expect(response.timestamp).toBeUndefined();
    });

    it('should handle speech not detected', () => {
      const response: VADEventResponse = {
        type: AgentResponseType.VAD_EVENT,
        speech_detected: false,
        confidence: 0.1
      };
      
      expect(response.speech_detected).toBe(false);
      expect(response.confidence).toBe(0.1);
    });

    it('should match AgentResponseType enum', () => {
      expect(AgentResponseType.VAD_EVENT).toBe('VADEvent');
    });
  });

  describe('Type Guards', () => {
    it('should identify UserStoppedSpeakingResponse', () => {
      const response = { type: 'UserStoppedSpeaking', timestamp: 1234567890 };
      
      expect(response.type).toBe('UserStoppedSpeaking');
      expect(response).toHaveProperty('timestamp');
    });

    it('should identify UtteranceEndResponse', () => {
      const response = { 
        type: 'UtteranceEnd', 
        channel: [0, 1], 
        last_word_end: 1.5 
      };
      
      expect(response.type).toBe('UtteranceEnd');
      expect(response).toHaveProperty('channel');
      expect(response).toHaveProperty('last_word_end');
    });

    it('should identify VADEventResponse', () => {
      const response = { 
        type: 'VADEvent', 
        speech_detected: true, 
        confidence: 0.9 
      };
      
      expect(response.type).toBe('VADEvent');
      expect(response).toHaveProperty('speech_detected');
    });
  });

  describe('Deepgram UtteranceEnd Compatibility', () => {
    it('should match Deepgram UtteranceEnd message structure', () => {
      // Based on Deepgram documentation:
      // {"type":"UtteranceEnd", "channel": [0,2], "last_word_end": 3.1}
      const deepgramMessage = {
        type: 'UtteranceEnd',
        channel: [0, 2],
        last_word_end: 3.1
      };
      
      // Test that the structure matches our expected format
      expect(deepgramMessage.type).toBe('UtteranceEnd');
      expect(deepgramMessage.channel).toEqual([0, 2]);
      expect(deepgramMessage.last_word_end).toBe(3.1);
      
      // Test that we can create our response type with the same data
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: deepgramMessage.channel,
        last_word_end: deepgramMessage.last_word_end
      };
      
      expect(response.type).toBe('UtteranceEnd');
      expect(response.channel).toEqual([0, 2]);
      expect(response.last_word_end).toBe(3.1);
    });

    it('should handle channel array format [channel_index, total_channels]', () => {
      const response: UtteranceEndResponse = {
        type: AgentResponseType.UTTERANCE_END,
        channel: [1, 3], // Channel 1 of 3 total channels
        last_word_end: 2.5
      };
      
      expect(response.channel[0]).toBe(1); // Channel index
      expect(response.channel[1]).toBe(3); // Total channels
    });
  });
});
