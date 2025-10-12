/**
 * VAD State Transition Tests
 * 
 * Test-Driven Development: Phase 2.3
 * 
 * These tests define the expected VAD state transition behavior before implementation.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 */

import { stateReducer, VoiceInteractionState } from '../../src/utils/state/VoiceInteractionState';
import { 
  AgentResponseType,
  UserStoppedSpeakingResponse,
  UtteranceEndResponse,
  VADEventResponse
} from '../../src/types/agent';

describe('VAD State Transitions', () => {
  const initialState: VoiceInteractionState = {
    connections: {
      transcription: 'closed',
      agent: 'closed',
    },
    agentState: 'idle',
    microphonePermission: 'prompt',
    isRecording: false,
    isPlaying: false,
    isReady: false,
    error: null,
    micEnabledInternal: false,
    hasSentSettings: false,
    welcomeReceived: false,
    greetingInProgress: false,
    greetingStarted: false,
    isNewConnection: true,
    hasEstablishedSession: false,
    conversationHistory: [],
    sessionId: null,
    // VAD-specific state properties
    isUserSpeaking: false,
    lastUserSpeechTime: null,
    currentSpeechDuration: null,
  };

  describe('User Speaking State Transitions', () => {
    it('should transition from not speaking to speaking', () => {
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true };
      const newState = stateReducer(initialState, action);
      
      expect(newState.isUserSpeaking).toBe(true);
      expect(newState.lastUserSpeechTime).toBeGreaterThan(0);
      expect(newState.currentSpeechDuration).toBeNull();
    });

    it('should transition from speaking to not speaking', () => {
      const speakingState = { ...initialState, isUserSpeaking: true, lastUserSpeechTime: 1000 };
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false };
      const newState = stateReducer(speakingState, action);
      
      expect(newState.isUserSpeaking).toBe(false);
      expect(newState.lastUserSpeechTime).toBe(1000); // Preserved
      expect(newState.currentSpeechDuration).toBeNull();
    });

    it('should preserve speech duration when transitioning to not speaking', () => {
      const speakingState = { 
        ...initialState, 
        isUserSpeaking: true, 
        currentSpeechDuration: 2.5 
      };
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false };
      const newState = stateReducer(speakingState, action);
      
      expect(newState.isUserSpeaking).toBe(false);
      expect(newState.currentSpeechDuration).toBe(2.5); // Preserved
    });
  });

  describe('UtteranceEnd State Transitions', () => {
    it('should transition to not speaking on UtteranceEnd', () => {
      const speakingState = { ...initialState, isUserSpeaking: true };
      const action = { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 2.5 } 
      };
      const newState = stateReducer(speakingState, action);
      
      expect(newState.isUserSpeaking).toBe(false);
      expect(newState.utteranceEndData).toEqual({
        channel: [0, 1],
        lastWordEnd: 2.5
      });
    });

    it('should preserve utterance end data', () => {
      const action = { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 2], lastWordEnd: 3.1 } 
      };
      const newState = stateReducer(initialState, action);
      
      expect(newState.utteranceEndData).toEqual({
        channel: [0, 2],
        lastWordEnd: 3.1
      });
    });

    it('should handle multiple UtteranceEnd events', () => {
      let state = initialState;
      
      // First utterance end
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 1.5 } 
      });
      
      // Second utterance end
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 3.0 } 
      });
      
      expect(state.utteranceEndData).toEqual({
        channel: [0, 1],
        lastWordEnd: 3.0
      });
    });
  });

  describe('Speech Duration State Transitions', () => {
    it('should update speech duration during speaking', () => {
      const speakingState = { ...initialState, isUserSpeaking: true };
      const action = { type: 'UPDATE_SPEECH_DURATION' as const, duration: 1.5 };
      const newState = stateReducer(speakingState, action);
      
      expect(newState.currentSpeechDuration).toBe(1.5);
      expect(newState.isUserSpeaking).toBe(true); // Preserved
    });

    it('should update speech duration multiple times', () => {
      let state = { ...initialState, isUserSpeaking: true };
      
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 1.0 });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 2.0 });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 3.0 });
      
      expect(state.currentSpeechDuration).toBe(3.0);
    });

    it('should handle speech duration updates when not speaking', () => {
      const action = { type: 'UPDATE_SPEECH_DURATION' as const, duration: 2.5 };
      const newState = stateReducer(initialState, action);
      
      expect(newState.currentSpeechDuration).toBe(2.5);
      expect(newState.isUserSpeaking).toBe(false); // Preserved
    });
  });

  describe('Speech Timer Reset Transitions', () => {
    it('should reset all speech-related state', () => {
      const speechState = {
        ...initialState,
        isUserSpeaking: true,
        lastUserSpeechTime: 1234567890,
        currentSpeechDuration: 2.5,
        utteranceEndData: { channel: [0, 1], lastWordEnd: 2.5 }
      };
      
      const action = { type: 'RESET_SPEECH_TIMER' as const };
      const newState = stateReducer(speechState, action);
      
      expect(newState.isUserSpeaking).toBe(false);
      expect(newState.lastUserSpeechTime).toBeNull();
      expect(newState.currentSpeechDuration).toBeNull();
      expect(newState.utteranceEndData).toBeUndefined();
    });

    it('should handle reset when already in clean state', () => {
      const action = { type: 'RESET_SPEECH_TIMER' as const };
      const newState = stateReducer(initialState, action);
      
      expect(newState.isUserSpeaking).toBe(false);
      expect(newState.lastUserSpeechTime).toBeNull();
      expect(newState.currentSpeechDuration).toBeNull();
      expect(newState.utteranceEndData).toBeUndefined();
    });
  });

  describe('Complete Speech Cycle Transitions', () => {
    it('should handle complete speech cycle: start -> duration -> end -> reset', () => {
      let state = initialState;
      
      // User starts speaking
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      expect(state.isUserSpeaking).toBe(true);
      expect(state.lastUserSpeechTime).toBeGreaterThan(0);
      
      // Update speech duration
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 1.5 });
      expect(state.currentSpeechDuration).toBe(1.5);
      
      // Utterance end
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 1.5 } 
      });
      expect(state.isUserSpeaking).toBe(false);
      expect(state.utteranceEndData).toEqual({ channel: [0, 1], lastWordEnd: 1.5 });
      
      // Reset for next cycle
      state = stateReducer(state, { type: 'RESET_SPEECH_TIMER' as const });
      expect(state.isUserSpeaking).toBe(false);
      expect(state.lastUserSpeechTime).toBeNull();
      expect(state.currentSpeechDuration).toBeNull();
      expect(state.utteranceEndData).toBeUndefined();
    });

    it('should handle rapid speech cycles', () => {
      let state = initialState;
      
      // Cycle 1: Quick speech
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 0.5 });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      
      // Cycle 2: Longer speech
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 1.2 });
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 1.2 } 
      });
      
      // Cycle 3: Very short speech
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 0.1 });
      state = stateReducer(state, { type: 'RESET_SPEECH_TIMER' as const });
      
      expect(state.isUserSpeaking).toBe(false);
      expect(state.lastUserSpeechTime).toBeNull();
      expect(state.currentSpeechDuration).toBeNull();
      expect(state.utteranceEndData).toBeUndefined();
    });
  });

  describe('VAD Event Integration Transitions', () => {
    it('should handle VADEvent -> UserStoppedSpeaking sequence', () => {
      let state = initialState;
      
      // VAD detects speech
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      expect(state.isUserSpeaking).toBe(true);
      
      // VAD detects no speech
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      expect(state.isUserSpeaking).toBe(false);
      
      // Agent confirms user stopped speaking
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 2.0 } 
      });
      expect(state.isUserSpeaking).toBe(false);
      expect(state.utteranceEndData).toEqual({ channel: [0, 1], lastWordEnd: 2.0 });
    });

    it('should handle UtteranceEnd -> VADEvent sequence', () => {
      let state = initialState;
      
      // Agent detects utterance end
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 1.5 } 
      });
      expect(state.isUserSpeaking).toBe(false);
      expect(state.utteranceEndData).toEqual({ channel: [0, 1], lastWordEnd: 1.5 });
      
      // VAD confirms no speech
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      expect(state.isUserSpeaking).toBe(false);
      
      // Reset for next cycle
      state = stateReducer(state, { type: 'RESET_SPEECH_TIMER' as const });
      expect(state.utteranceEndData).toBeUndefined();
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle overlapping speech events', () => {
      let state = initialState;
      
      // Start speaking
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      
      // Overlapping UtteranceEnd (should still work)
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 0.5 } 
      });
      expect(state.isUserSpeaking).toBe(false);
      
      // Start speaking again
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      expect(state.isUserSpeaking).toBe(true);
    });

    it('should handle rapid state changes', () => {
      let state = initialState;
      
      // Rapid state changes
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      
      expect(state.isUserSpeaking).toBe(false);
    });

    it('should handle duration updates during rapid changes', () => {
      let state = initialState;
      
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 0.1 });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 0.2 });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 0.3 });
      
      expect(state.currentSpeechDuration).toBe(0.3);
      expect(state.isUserSpeaking).toBe(true);
    });
  });

  describe('State Transition Performance', () => {
    it('should handle high-frequency state transitions efficiently', () => {
      let state = initialState;
      const startTime = Date.now();
      
      // Simulate high-frequency VAD events
      for (let i = 0; i < 100; i++) {
        state = stateReducer(state, { 
          type: 'USER_SPEAKING_STATE_CHANGE' as const, 
          isSpeaking: i % 2 === 0 
        });
        state = stateReducer(state, { 
          type: 'UPDATE_SPEECH_DURATION' as const, 
          duration: i * 0.01 
        });
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(50); // Should process 200 state changes in <50ms
      expect(state.currentSpeechDuration).toBe(0.99);
      expect(state.isUserSpeaking).toBe(false);
    });

    it('should maintain state consistency during rapid transitions', () => {
      let state = initialState;
      
      // Rapid transitions with mixed events
      for (let i = 0; i < 50; i++) {
        state = stateReducer(state, { 
          type: 'USER_SPEAKING_STATE_CHANGE' as const, 
          isSpeaking: i % 3 === 0 
        });
        
        if (i % 5 === 0) {
          state = stateReducer(state, { 
            type: 'UTTERANCE_END' as const, 
            data: { channel: [0, 1], lastWordEnd: i * 0.1 } 
          });
        }
        
        if (i % 7 === 0) {
          state = stateReducer(state, { type: 'RESET_SPEECH_TIMER' as const });
        }
      }
      
      // State should be consistent
      expect(typeof state.isUserSpeaking).toBe('boolean');
      expect(state.lastUserSpeechTime === null || typeof state.lastUserSpeechTime === 'number').toBe(true);
      expect(state.currentSpeechDuration === null || typeof state.currentSpeechDuration === 'number').toBe(true);
    });
  });

  describe('State Transition Validation', () => {
    it('should validate state transitions maintain immutability', () => {
      const originalState = { ...initialState };
      
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true };
      const newState = stateReducer(originalState, action);
      
      // Original state should be unchanged
      expect(originalState.isUserSpeaking).toBe(false);
      expect(originalState.lastUserSpeechTime).toBeNull();
      
      // New state should be different
      expect(newState).not.toBe(originalState);
      expect(newState.isUserSpeaking).toBe(true);
    });

    it('should validate state transitions preserve non-VAD properties', () => {
      const stateWithOtherProps = {
        ...initialState,
        agentState: 'thinking' as const,
        isRecording: true,
        isPlaying: false
      };
      
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true };
      const newState = stateReducer(stateWithOtherProps, action);
      
      // VAD properties should change
      expect(newState.isUserSpeaking).toBe(true);
      
      // Other properties should be preserved
      expect(newState.agentState).toBe('thinking');
      expect(newState.isRecording).toBe(true);
      expect(newState.isPlaying).toBe(false);
    });
  });
});
