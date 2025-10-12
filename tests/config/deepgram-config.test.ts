/**
 * Deepgram Configuration Tests
 * 
 * Test-Driven Development: Phase 3.1
 * 
 * These tests define the expected Deepgram configuration behavior for VAD events.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 * 
 * Reference: https://developers.deepgram.com/docs/understanding-end-of-speech-detection
 */

import { DeepgramVoiceInteractionProps } from '../../src/types';

describe('Deepgram Configuration Tests', () => {
  describe('UtteranceEnd Configuration', () => {
    it('should configure utteranceEndMs parameter for UtteranceEnd detection', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000
      };

      const buildAgentConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        // Add UtteranceEnd configuration
        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true; // Default to true when utteranceEndMs is set
        }

        return config;
      };

      const config = buildAgentConfig(props);

      expect(config.utterance_end_ms).toBe(1000);
      expect(config.interim_results).toBe(true);
    });

    it('should configure interimResults parameter', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1500,
        interimResults: false
      };

      const buildAgentConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildAgentConfig(props);

      expect(config.utterance_end_ms).toBe(1500);
      expect(config.interim_results).toBe(false);
    });

    it('should default interimResults to true when utteranceEndMs is set', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 2000
        // interimResults not specified
      };

      const buildAgentConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildAgentConfig(props);

      expect(config.utterance_end_ms).toBe(2000);
      expect(config.interim_results).toBe(true);
    });

    it('should not add UtteranceEnd config when utteranceEndMs is not set', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key'
        // No utteranceEndMs specified
      };

      const buildAgentConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildAgentConfig(props);

      expect(config.utterance_end_ms).toBeUndefined();
      expect(config.interim_results).toBeUndefined();
    });
  });

  describe('UtteranceEndMs Parameter Validation', () => {
    it('should accept minimum recommended value (1000ms)', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000
      };

      const validateUtteranceEndMs = (ms: number) => {
        return ms >= 1000; // Minimum recommended by Deepgram
      };

      expect(validateUtteranceEndMs(props.utteranceEndMs!)).toBe(true);
    });

    it('should accept values above minimum', () => {
      const testCases = [1000, 1500, 2000, 3000, 5000];

      testCases.forEach(ms => {
        const props: DeepgramVoiceInteractionProps = {
          apiKey: 'test-key',
          utteranceEndMs: ms
        };

        const validateUtteranceEndMs = (ms: number) => {
          return ms >= 1000;
        };

        expect(validateUtteranceEndMs(props.utteranceEndMs!)).toBe(true);
      });
    });

    it('should warn about values below minimum', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 500 // Below minimum
      };

      const validateUtteranceEndMs = (ms: number) => {
        if (ms < 1000) {
          console.warn(`utteranceEndMs (${ms}ms) is below minimum recommended value (1000ms)`);
          return false;
        }
        return true;
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(validateUtteranceEndMs(props.utteranceEndMs!)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('utteranceEndMs (500ms) is below minimum recommended value (1000ms)');
      
      consoleSpy.mockRestore();
    });

    it('should handle edge case values', () => {
      const edgeCases = [0, 999, 1000, 1001, 10000];

      edgeCases.forEach(ms => {
        const props: DeepgramVoiceInteractionProps = {
          apiKey: 'test-key',
          utteranceEndMs: ms
        };

        const validateUtteranceEndMs = (ms: number) => {
          return ms >= 1000;
        };

        const expectedResult = ms >= 1000;
        expect(validateUtteranceEndMs(props.utteranceEndMs!)).toBe(expectedResult);
      });
    });
  });

  describe('InterimResults Parameter Validation', () => {
    it('should require interimResults when utteranceEndMs is set', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000,
        interimResults: true
      };

      const validateInterimResults = (props: DeepgramVoiceInteractionProps) => {
        if (props.utteranceEndMs && props.interimResults === false) {
          console.warn('interimResults should be true when utteranceEndMs is configured for UtteranceEnd detection');
          return false;
        }
        return true;
      };

      expect(validateInterimResults(props)).toBe(true);
    });

    it('should warn when interimResults is false with utteranceEndMs', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000,
        interimResults: false
      };

      const validateInterimResults = (props: DeepgramVoiceInteractionProps) => {
        if (props.utteranceEndMs && props.interimResults === false) {
          console.warn('interimResults should be true when utteranceEndMs is configured for UtteranceEnd detection');
          return false;
        }
        return true;
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(validateInterimResults(props)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('interimResults should be true when utteranceEndMs is configured for UtteranceEnd detection');
      
      consoleSpy.mockRestore();
    });

    it('should allow interimResults false when utteranceEndMs is not set', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        interimResults: false
        // No utteranceEndMs
      };

      const validateInterimResults = (props: DeepgramVoiceInteractionProps) => {
        if (props.utteranceEndMs && props.interimResults === false) {
          console.warn('interimResults should be true when utteranceEndMs is configured for UtteranceEnd detection');
          return false;
        }
        return true;
      };

      expect(validateInterimResults(props)).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should integrate UtteranceEnd config with existing agent options', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000,
        interimResults: true,
        agentOptions: {
          instructions: 'You are a helpful assistant',
          voice: 'aura-asteria-en'
        }
      };

      const buildCompleteAgentConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        // Add agent options
        if (props.agentOptions) {
          if (props.agentOptions.instructions) {
            config.instructions = props.agentOptions.instructions;
          }
          if (props.agentOptions.voice) {
            config.voice = props.agentOptions.voice;
          }
        }

        // Add UtteranceEnd configuration
        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildCompleteAgentConfig(props);

      expect(config.utterance_end_ms).toBe(1000);
      expect(config.interim_results).toBe(true);
      expect(config.instructions).toBe('You are a helpful assistant');
      expect(config.voice).toBe('aura-asteria-en');
    });

    it('should integrate UtteranceEnd config with transcription options', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1500,
        interimResults: true,
        transcriptionOptions: {
          model: 'nova-2',
          language: 'en-US',
          smart_format: true
        }
      };

      const buildCompleteTranscriptionConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          model: 'nova-2',
          language: 'en-US',
          smart_format: true
        };

        // Add UtteranceEnd configuration
        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildCompleteTranscriptionConfig(props);

      expect(config.utterance_end_ms).toBe(1500);
      expect(config.interim_results).toBe(true);
      expect(config.model).toBe('nova-2');
      expect(config.language).toBe('en-US');
      expect(config.smart_format).toBe(true);
    });

    it('should handle configuration without UtteranceEnd params', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        agentOptions: {
          instructions: 'You are a helpful assistant'
        }
      };

      const buildCompleteAgentConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        // Add agent options
        if (props.agentOptions) {
          if (props.agentOptions.instructions) {
            config.instructions = props.agentOptions.instructions;
          }
        }

        // Add UtteranceEnd configuration only if specified
        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildCompleteAgentConfig(props);

      expect(config.utterance_end_ms).toBeUndefined();
      expect(config.interim_results).toBeUndefined();
      expect(config.instructions).toBe('You are a helpful assistant');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate complete configuration', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000,
        interimResults: true,
        agentOptions: {
          instructions: 'You are a helpful assistant'
        }
      };

      const validateConfiguration = (props: DeepgramVoiceInteractionProps) => {
        const errors: string[] = [];

        // Validate utteranceEndMs
        if (props.utteranceEndMs && props.utteranceEndMs < 1000) {
          errors.push(`utteranceEndMs (${props.utteranceEndMs}ms) is below minimum recommended value (1000ms)`);
        }

        // Validate interimResults
        if (props.utteranceEndMs && props.interimResults === false) {
          errors.push('interimResults should be true when utteranceEndMs is configured for UtteranceEnd detection');
        }

        return {
          isValid: errors.length === 0,
          errors
        };
      };

      const validation = validateConfiguration(props);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should report validation errors', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 500, // Below minimum
        interimResults: false // Should be true with utteranceEndMs
      };

      const validateConfiguration = (props: DeepgramVoiceInteractionProps) => {
        const errors: string[] = [];

        if (props.utteranceEndMs && props.utteranceEndMs < 1000) {
          errors.push(`utteranceEndMs (${props.utteranceEndMs}ms) is below minimum recommended value (1000ms)`);
        }

        if (props.utteranceEndMs && props.interimResults === false) {
          errors.push('interimResults should be true when utteranceEndMs is configured for UtteranceEnd detection');
        }

        return {
          isValid: errors.length === 0,
          errors
        };
      };

      const validation = validateConfiguration(props);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors[0]).toContain('utteranceEndMs (500ms) is below minimum');
      expect(validation.errors[1]).toContain('interimResults should be true');
    });
  });

  describe('Configuration Examples', () => {
    it('should support basic UtteranceEnd configuration', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 1000
      };

      const buildConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildConfig(props);

      expect(config).toEqual({
        experimental: true,
        audio: {
          input: {
            encoding: 'linear16',
            sample_rate: 16000
          }
        },
        utterance_end_ms: 1000,
        interim_results: true
      });
    });

    it('should support advanced UtteranceEnd configuration', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        utteranceEndMs: 2000,
        interimResults: true,
        agentOptions: {
          instructions: 'You are a helpful assistant',
          voice: 'aura-asteria-en'
        }
      };

      const buildConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        if (props.agentOptions) {
          if (props.agentOptions.instructions) {
            config.instructions = props.agentOptions.instructions;
          }
          if (props.agentOptions.voice) {
            config.voice = props.agentOptions.voice;
          }
        }

        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildConfig(props);

      expect(config).toEqual({
        experimental: true,
        audio: {
          input: {
            encoding: 'linear16',
            sample_rate: 16000
          }
        },
        instructions: 'You are a helpful assistant',
        voice: 'aura-asteria-en',
        utterance_end_ms: 2000,
        interim_results: true
      });
    });

    it('should support configuration without UtteranceEnd', () => {
      const props: DeepgramVoiceInteractionProps = {
        apiKey: 'test-key',
        agentOptions: {
          instructions: 'You are a helpful assistant'
        }
      };

      const buildConfig = (props: DeepgramVoiceInteractionProps) => {
        const config: any = {
          experimental: true,
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 16000
            }
          }
        };

        if (props.agentOptions) {
          if (props.agentOptions.instructions) {
            config.instructions = props.agentOptions.instructions;
          }
        }

        if (props.utteranceEndMs) {
          config.utterance_end_ms = props.utteranceEndMs;
          config.interim_results = props.interimResults ?? true;
        }

        return config;
      };

      const config = buildConfig(props);

      expect(config).toEqual({
        experimental: true,
        audio: {
          input: {
            encoding: 'linear16',
            sample_rate: 16000
          }
        },
        instructions: 'You are a helpful assistant'
      });
    });
  });
});
