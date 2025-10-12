/**
 * VAD State Management Tests
 * 
 * Test-Driven Development: Phase 1.2
 * 
 * These tests define the expected VAD state management behavior before implementation.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 */

import { stateReducer, VoiceInteractionState } from '../../src/utils/state/VoiceInteractionState';

describe('VAD State Management', () => {
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

  describe('USER_SPEAKING_STATE_CHANGE', () => {
    it('should track user speaking state', () => {
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true };
      const newState = stateReducer(initialState, action);
      
      expect(newState.isUserSpeaking).toBe(true);
    });

    it('should update user speaking state to false', () => {
      const stateWithSpeaking = { ...initialState, isUserSpeaking: true };
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false };
      const newState = stateReducer(stateWithSpeaking, action);
      
      expect(newState.isUserSpeaking).toBe(false);
    });

    it('should preserve other state properties', () => {
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true };
      const newState = stateReducer(initialState, action);
      
      expect(newState.agentState).toBe(initialState.agentState);
      expect(newState.isRecording).toBe(initialState.isRecording);
      expect(newState.isPlaying).toBe(initialState.isPlaying);
    });
  });

  describe('UTTERANCE_END', () => {
    it('should handle UtteranceEnd state updates', () => {
      const stateWithSpeaking = { ...initialState, isUserSpeaking: true };
      const action = { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 2.5 } 
      };
      const newState = stateReducer(stateWithSpeaking, action);
      
      expect(newState.isUserSpeaking).toBe(false);
    });

    it('should preserve utterance end data', () => {
      const action = { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 2], lastWordEnd: 3.1 } 
      };
      const newState = stateReducer(initialState, action);
      
      // Note: We'll need to add utteranceEndData to the state interface
      // This test will fail initially, driving the implementation
      expect((newState as any).utteranceEndData).toEqual({
        channel: [0, 2],
        lastWordEnd: 3.1
      });
    });

    it('should handle multi-channel utterance end', () => {
      const action = { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [1, 4], lastWordEnd: 1.8 } 
      };
      const newState = stateReducer(initialState, action);
      
      expect((newState as any).utteranceEndData).toEqual({
        channel: [1, 4],
        lastWordEnd: 1.8
      });
    });
  });

  describe('UPDATE_SPEECH_DURATION', () => {
    it('should update current speech duration', () => {
      const action = { type: 'UPDATE_SPEECH_DURATION' as const, duration: 2.5 };
      const newState = stateReducer(initialState, action);
      
      expect(newState.currentSpeechDuration).toBe(2.5);
    });

    it('should update speech duration multiple times', () => {
      const stateWithDuration = { ...initialState, currentSpeechDuration: 1.0 };
      const action = { type: 'UPDATE_SPEECH_DURATION' as const, duration: 3.2 };
      const newState = stateReducer(stateWithDuration, action);
      
      expect(newState.currentSpeechDuration).toBe(3.2);
    });
  });

  describe('RESET_SPEECH_TIMER', () => {
    it('should reset speech timer and duration', () => {
      const stateWithSpeechData = {
        ...initialState,
        isUserSpeaking: true,
        lastUserSpeechTime: 1234567890,
        currentSpeechDuration: 2.5
      };
      
      const action = { type: 'RESET_SPEECH_TIMER' as const };
      const newState = stateReducer(stateWithSpeechData, action);
      
      expect(newState.isUserSpeaking).toBe(false);
      expect(newState.lastUserSpeechTime).toBeNull();
      expect(newState.currentSpeechDuration).toBeNull();
    });

    it('should handle reset when already in clean state', () => {
      const action = { type: 'RESET_SPEECH_TIMER' as const };
      const newState = stateReducer(initialState, action);
      
      expect(newState.isUserSpeaking).toBe(false);
      expect(newState.lastUserSpeechTime).toBeNull();
      expect(newState.currentSpeechDuration).toBeNull();
    });
  });

  describe('VAD State Transitions', () => {
    it('should handle complete speech cycle state transitions', () => {
      let state = initialState;
      
      // User starts speaking
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      expect(state.isUserSpeaking).toBe(true);
      
      // Update speech duration
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 1.5 });
      expect(state.currentSpeechDuration).toBe(1.5);
      
      // Utterance end
      state = stateReducer(state, { 
        type: 'UTTERANCE_END' as const, 
        data: { channel: [0, 1], lastWordEnd: 1.5 } 
      });
      expect(state.isUserSpeaking).toBe(false);
      
      // Reset for next cycle
      state = stateReducer(state, { type: 'RESET_SPEECH_TIMER' as const });
      expect(state.isUserSpeaking).toBe(false);
      expect(state.currentSpeechDuration).toBeNull();
    });

    it('should handle rapid speech start/stop cycles', () => {
      let state = initialState;
      
      // Rapid cycle 1
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 0.5 });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      
      // Rapid cycle 2
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true });
      state = stateReducer(state, { type: 'UPDATE_SPEECH_DURATION' as const, duration: 0.8 });
      state = stateReducer(state, { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: false });
      
      expect(state.isUserSpeaking).toBe(false);
      expect(state.currentSpeechDuration).toBe(0.8);
    });
  });

  describe('State Immutability', () => {
    it('should not mutate original state', () => {
      const originalState = { ...initialState };
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true };
      
      stateReducer(originalState, action);
      
      expect(originalState.isUserSpeaking).toBe(false);
    });

    it('should create new state object', () => {
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' as const, isSpeaking: true };
      const newState = stateReducer(initialState, action);
      
      expect(newState).not.toBe(initialState);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown action types gracefully', () => {
      const action = { type: 'UNKNOWN_ACTION' as any };
      const newState = stateReducer(initialState, action);
      
      expect(newState).toEqual(initialState);
    });

    it('should handle malformed actions', () => {
      const action = { type: 'USER_SPEAKING_STATE_CHANGE' } as any; // Missing isSpeaking
      const newState = stateReducer(initialState, action);
      
      // Should not crash and return original state
      expect(newState).toEqual(initialState);
    });
  });
});
