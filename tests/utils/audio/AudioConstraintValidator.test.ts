/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Unit Tests for AudioConstraintValidator
 * 
 * Issue: #243 - Enhanced Echo Cancellation Support and Browser Compatibility
 * 
 * Tests the AudioConstraintValidator utility that validates audio constraints
 * before applying them to getUserMedia.
 */

import { AudioConstraintValidator } from '../../../src/utils/audio/AudioConstraintValidator';
import { AudioConstraints } from '../../../src/types';

describe('AudioConstraintValidator', () => {
  beforeEach(() => {
    // Setup mock for getSupportedConstraints
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    beforeEach(() => {
      // Mock getSupportedConstraints to return all constraints supported
      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => ({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: true,
        channelCount: true,
      }));
    });

    it('should validate valid constraints', () => {
      const constraints: AudioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid sample rate', () => {
      const constraints: AudioConstraints = {
        sampleRate: 5000, // Too low
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sample rate 5000 is outside valid range (8000-48000 Hz)');
    });

    it('should detect sample rate too high', () => {
      const constraints: AudioConstraints = {
        sampleRate: 96000, // Too high
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sample rate 96000 is outside valid range (8000-48000 Hz)');
    });

    it('should detect invalid channel count', () => {
      const constraints: AudioConstraints = {
        channelCount: 4, // Invalid (must be 1 or 2)
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Channel count 4 is invalid (must be 1 or 2)');
    });

    it('should accept valid channel count (1)', () => {
      const constraints: AudioConstraints = {
        channelCount: 1,
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid channel count (2)', () => {
      const constraints: AudioConstraints = {
        channelCount: 2,
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn when constraint is not supported', () => {
      // Mock getSupportedConstraints to return echoCancellation as false
      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => ({
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: true,
        channelCount: true,
      }));

      const constraints: AudioConstraints = {
        echoCancellation: true,
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings).toContain('Browser does not support echoCancellation constraint');
    });

    it('should handle multiple warnings', () => {
      // Mock getSupportedConstraints to return multiple unsupported constraints
      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => ({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: true,
        channelCount: true,
      }));

      const constraints: AudioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings).toContain('Browser does not support echoCancellation constraint');
      expect(result.warnings).toContain('Browser does not support noiseSuppression constraint');
      expect(result.warnings).toContain('Browser does not support autoGainControl constraint');
    });

    it('should handle empty constraints', () => {
      const constraints: AudioConstraints = {};

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle partial constraints', () => {
      const constraints: AudioConstraints = {
        echoCancellation: true,
        // Other constraints not specified
      };

      const result = AudioConstraintValidator.validate(constraints);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isConstraintSupported', () => {
    it('should return true when constraint is supported', () => {
      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => ({
        echoCancellation: true,
      }));

      const supported = AudioConstraintValidator.isConstraintSupported('echoCancellation');

      expect(supported).toBe(true);
    });

    it('should return false when constraint is not supported', () => {
      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => ({
        echoCancellation: false,
      }));

      const supported = AudioConstraintValidator.isConstraintSupported('echoCancellation');

      expect(supported).toBe(false);
    });

    it('should return false when constraint is not in supported list', () => {
      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => ({}));

      const supported = AudioConstraintValidator.isConstraintSupported('echoCancellation');

      expect(supported).toBe(false);
    });

    it('should handle when getSupportedConstraints is not available', () => {
      delete (navigator.mediaDevices as any).getSupportedConstraints;

      const supported = AudioConstraintValidator.isConstraintSupported('echoCancellation');

      expect(supported).toBe(false);
    });
  });
});

