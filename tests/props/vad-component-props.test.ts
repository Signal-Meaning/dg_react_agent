/**
 * VAD Component Props Tests
 * 
 * Test-Driven Development: Phase 2.1
 * 
 * These tests define the expected VAD component props interface before implementation.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 */

import { DeepgramVoiceInteractionProps } from '../../src/types';

describe('VAD Component Props', () => {
  describe('VAD Callback Props', () => {
    it('should define onUserStoppedSpeaking prop', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStoppedSpeaking: jest.fn()
      };

      expect(props.onUserStoppedSpeaking).toBeDefined();
      expect(typeof props.onUserStoppedSpeaking).toBe('function');
    });

    it('should define onUtteranceEnd prop', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUtteranceEnd: jest.fn()
      };

      expect(props.onUtteranceEnd).toBeDefined();
      expect(typeof props.onUtteranceEnd).toBe('function');
    });

    it('should define onUserStartedSpeaking prop', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStartedSpeaking: jest.fn()
      };

      expect(props.onUserStartedSpeaking).toBeDefined();
      expect(typeof props.onUserStartedSpeaking).toBe('function');
    });

    it('should make VAD callback props optional', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key'
        // No VAD callbacks provided
      };

      expect(props.onUserStoppedSpeaking).toBeUndefined();
      expect(props.onUtteranceEnd).toBeUndefined();
      expect(props.onUserStartedSpeaking).toBeUndefined();
    });
  });

  describe('onUserStoppedSpeaking Callback', () => {
    it('should call onUserStoppedSpeaking with timestamp when provided', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStoppedSpeaking: mockCallback
      };

      // Simulate calling the callback
      const timestamp = 1234567890;
      props.onUserStoppedSpeaking?.({ timestamp });

      expect(mockCallback).toHaveBeenCalledWith({ timestamp });
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should call onUserStoppedSpeaking without timestamp', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStoppedSpeaking: mockCallback
      };

      // Simulate calling the callback without timestamp
      props.onUserStoppedSpeaking?.({});

      expect(mockCallback).toHaveBeenCalledWith({});
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple calls to onUserStoppedSpeaking', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStoppedSpeaking: mockCallback
      };

      props.onUserStoppedSpeaking?.({ timestamp: 1000 });
      props.onUserStoppedSpeaking?.({ timestamp: 2000 });

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenNthCalledWith(1, { timestamp: 1000 });
      expect(mockCallback).toHaveBeenNthCalledWith(2, { timestamp: 2000 });
    });
  });

  describe('onUtteranceEnd Callback', () => {
    it('should call onUtteranceEnd with channel and lastWordEnd', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUtteranceEnd: mockCallback
      };

      const data = {
        channel: [0, 2],
        lastWordEnd: 3.1
      };

      props.onUtteranceEnd?.(data);

      expect(mockCallback).toHaveBeenCalledWith(data);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle single channel audio', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUtteranceEnd: mockCallback
      };

      const data = {
        channel: [0, 1],
        lastWordEnd: 1.5
      };

      props.onUtteranceEnd?.(data);

      expect(mockCallback).toHaveBeenCalledWith(data);
    });

    it('should handle multi-channel audio', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUtteranceEnd: mockCallback
      };

      const data = {
        channel: [1, 4],
        lastWordEnd: 2.7
      };

      props.onUtteranceEnd?.(data);

      expect(mockCallback).toHaveBeenCalledWith(data);
    });

    it('should handle multiple UtteranceEnd events', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUtteranceEnd: mockCallback
      };

      const data1 = { channel: [0, 1], lastWordEnd: 1.0 };
      const data2 = { channel: [0, 1], lastWordEnd: 2.5 };

      props.onUtteranceEnd?.(data1);
      props.onUtteranceEnd?.(data2);

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenNthCalledWith(1, data1);
      expect(mockCallback).toHaveBeenNthCalledWith(2, data2);
    });
  });

  describe('onUserStartedSpeaking Callback', () => {
    it('should call onUserStartedSpeaking when user starts speaking', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStartedSpeaking: mockCallback
      };

      props.onUserStartedSpeaking?.();

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('onUserStoppedSpeaking Callback', () => {
    it('should call onUserStoppedSpeaking when user stops speaking', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStoppedSpeaking: mockCallback
      };

      props.onUserStoppedSpeaking?.();

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('onUtteranceEnd Callback', () => {
    it('should call onUtteranceEnd with utterance data', () => {
      const mockCallback = jest.fn();
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUtteranceEnd: mockCallback
      };

      const data = {
        channel: [0],
        lastWordEnd: 1.5
      };

      props.onUtteranceEnd?.(data);

      expect(mockCallback).toHaveBeenCalledWith(data);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('VAD Configuration Props', () => {
    it('should define utteranceEndMs prop for Deepgram configuration', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000
      };

      expect(props.utteranceEndMs).toBe(1000);
    });

    it('should define interimResults prop for Deepgram configuration', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        interimResults: true
      };

      expect(props.interimResults).toBe(true);
    });

    it('should make VAD configuration props optional', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key'
        // No VAD configuration provided
      };

      expect(props.utteranceEndMs).toBeUndefined();
      expect(props.interimResults).toBeUndefined();
    });

    it('should handle utteranceEndMs with different values', () => {
      const testCases = [500, 1000, 1500, 2000];

      testCases.forEach(ms => {
        const props: DeepgramVoiceInteractionProps = {
          apiKey: 'test-key',
          utteranceEndMs: ms
        };

        expect(props.utteranceEndMs).toBe(ms);
      });
    });

    it('should handle interimResults boolean values', () => {
      const testCases = [true, false];

      testCases.forEach(value => {
        const props: DeepgramVoiceInteractionProps = {
          apiKey: 'test-key',
          interimResults: value
        };

        expect(props.interimResults).toBe(value);
      });
    });
  });

  describe('Props Integration', () => {
    it('should support all VAD props together', () => {
      const mockOnUserStoppedSpeaking = jest.fn();
      const mockOnUtteranceEnd = jest.fn();
      const mockOnUserStartedSpeaking = jest.fn();

      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStoppedSpeaking: mockOnUserStoppedSpeaking,
        onUtteranceEnd: mockOnUtteranceEnd,
        onUserStartedSpeaking: mockOnUserStartedSpeaking,
        utteranceEndMs: 1000,
        interimResults: true
      };

      expect(props.onUserStoppedSpeaking).toBe(mockOnUserStoppedSpeaking);
      expect(props.onUtteranceEnd).toBe(mockOnUtteranceEnd);
      expect(props.onUserStartedSpeaking).toBe(mockOnUserStartedSpeaking);
      expect(props.utteranceEndMs).toBe(1000);
      expect(props.interimResults).toBe(true);
    });

    it('should maintain backward compatibility with existing props', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onTranscriptUpdate: jest.fn(),
        onAgentUtterance: jest.fn(),
        onUserStoppedSpeaking: jest.fn(), // New VAD prop
        utteranceEndMs: 1000 // New VAD prop
      };

      // Existing props should still work
      expect(props.onTranscriptUpdate).toBeDefined();
      expect(props.onAgentUtterance).toBeDefined();
      
      // New VAD props should work alongside existing ones
      expect(props.onUserStoppedSpeaking).toBeDefined();
      expect(props.utteranceEndMs).toBe(1000);
    });

    it('should handle mixed optional and required props', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key', // Required
        onUserStoppedSpeaking: jest.fn(), // Optional VAD callback
        utteranceEndMs: 1000, // Optional VAD config
        // onUtteranceEnd and onUserStartedSpeaking not provided (optional)
        // interimResults not provided (optional)
      };

      expect(props.apiKey).toBe('test-key');
      expect(props.onUserStoppedSpeaking).toBeDefined();
      expect(props.utteranceEndMs).toBe(1000);
      expect(props.onUtteranceEnd).toBeUndefined();
      expect(props.onUserStartedSpeaking).toBeUndefined();
      expect(props.interimResults).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct callback parameter types', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        onUserStoppedSpeaking: (data: { timestamp?: number }) => {
          expect(typeof data.timestamp === 'number' || data.timestamp === undefined).toBe(true);
        },
        onUtteranceEnd: (data: { channel: number[]; lastWordEnd: number }) => {
          expect(Array.isArray(data.channel)).toBe(true);
          expect(typeof data.lastWordEnd).toBe('number');
        },
        onUserStartedSpeaking: () => {
          // Simple callback with no parameters
        }
      };

      // Test the callbacks with valid data
      props.onUserStoppedSpeaking?.({ timestamp: 1234567890 });
      props.onUtteranceEnd?.({ channel: [0, 1], lastWordEnd: 1.5 });
      props.onUserStartedSpeaking?.();
    });

    it('should enforce correct configuration prop types', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000, // Should be number
        interimResults: true // Should be boolean
      };

      expect(typeof props.utteranceEndMs).toBe('number');
      expect(typeof props.interimResults).toBe('boolean');
    });
  });
});
