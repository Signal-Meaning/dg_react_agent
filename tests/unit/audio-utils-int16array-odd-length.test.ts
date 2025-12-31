/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Unit Test: AudioUtils createAudioBuffer() - Int16Array Odd-Length Buffer Error
 * 
 * Issue #340: Int16Array Error: TTS Audio Processing Fails with Odd-Length Buffers
 * 
 * This test demonstrates the defect where createAudioBuffer() throws a RangeError
 * when processing TTS audio buffers with odd byte lengths.
 * 
 * Expected Behavior (After Fix):
 * - Component should handle odd-length buffers gracefully
 * - Should truncate to even length before creating Int16Array
 * - Should log a warning when truncation occurs
 * - Should not throw RangeError
 * 
 * Current Behavior (Demonstrating Defect):
 * - Throws RangeError: byte length of Int16Array should be a multiple of 2
 * - Connection may close due to unhandled error
 */

import { createAudioBuffer } from '../../src/utils/audio/AudioUtils';

// Mock AudioContext
const mockAudioContext = {
  createBuffer: jest.fn((channels: number, length: number, sampleRate: number) => ({
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: jest.fn((channelIndex: number) => {
      return new Float32Array(length);
    }),
  })),
  destination: {},
  state: 'running',
  currentTime: 0,
};

// Mock global AudioContext
global.AudioContext = jest.fn(() => mockAudioContext as any);

describe('AudioUtils createAudioBuffer() - Odd-Length Buffer Handling', () => {
  let audioContext: AudioContext;

  beforeEach(() => {
    jest.clearAllMocks();
    audioContext = new AudioContext();
  });

  describe('Issue #340: Int16Array Error with Odd-Length Buffers', () => {
    it('should handle odd-length buffers gracefully (defect fixed)', () => {
      // Arrange: Create an ArrayBuffer with odd byte length (e.g., 1001 bytes)
      // PCM16 requires 2 bytes per sample, so odd lengths are invalid
      // After fix: Should truncate to even length instead of throwing
      const oddLengthBytes = 1001; // Odd number
      const oddLengthBuffer = new ArrayBuffer(oddLengthBytes);
      
      // Fill with some test data
      const view = new Uint8Array(oddLengthBuffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256;
      }

      // Act & Assert: Should NOT throw, should truncate to even length
      expect(() => {
        createAudioBuffer(audioContext, oddLengthBuffer, 24000);
      }).not.toThrow();
      
      const result = createAudioBuffer(audioContext, oddLengthBuffer, 24000);
      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(
        1,
        500, // 1000 bytes / 2 bytes per sample = 500 samples (truncated from 1001)
        24000
      );
    });

    it('should handle odd-length buffers gracefully by truncating to even length (expected after fix)', () => {
      // Arrange: Create an ArrayBuffer with odd byte length
      const oddLengthBytes = 1001;
      const oddLengthBuffer = new ArrayBuffer(oddLengthBytes);
      
      // Fill with some test data (not critical for this test)
      const view = new Uint8Array(oddLengthBuffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256;
      }

      // Act: Should not throw, should truncate to even length
      const result = createAudioBuffer(audioContext, oddLengthBuffer, 24000);

      // Assert: Should succeed with truncated buffer
      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(
        1,
        500, // 1000 bytes / 2 bytes per sample = 500 samples (truncated from 1001)
        24000
      );
    });

    it('should handle even-length buffers correctly (baseline test)', () => {
      // Arrange: Create an ArrayBuffer with even byte length
      const evenLengthBytes = 1000; // Even number
      const evenLengthBuffer = new ArrayBuffer(evenLengthBytes);
      
      // Fill with test data
      const view = new Uint8Array(evenLengthBuffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256;
      }

      // Act: Should work correctly
      const result = createAudioBuffer(audioContext, evenLengthBuffer, 24000);

      // Assert: Should succeed
      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(
        1,
        500, // 1000 bytes / 2 bytes per sample = 500 samples
        24000
      );
    });

    it('should handle various odd-length buffers (1001, 1003, 1005, etc.)', () => {
      const oddLengths = [1001, 1003, 1005, 1, 3, 5, 999, 10001];
      
      oddLengths.forEach((length) => {
        const buffer = new ArrayBuffer(length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < view.length; i++) {
          view[i] = i % 256;
        }

        // Should not throw after fix
        expect(() => {
          createAudioBuffer(audioContext, buffer, 24000);
        }).not.toThrow();
      });
    });

    it('should handle edge case: single byte buffer', () => {
      const singleByteBuffer = new ArrayBuffer(1);
      const view = new Uint8Array(singleByteBuffer);
      view[0] = 128;

      // Should truncate to 0 bytes (empty buffer)
      const result = createAudioBuffer(audioContext, singleByteBuffer, 24000);
      
      // Empty buffer should return undefined
      expect(result).toBeUndefined();
    });

    it('should handle edge case: three byte buffer', () => {
      const threeByteBuffer = new ArrayBuffer(3);
      const view = new Uint8Array(threeByteBuffer);
      view[0] = 0;
      view[1] = 1;
      view[2] = 2;

      // Should truncate to 2 bytes (1 sample)
      const result = createAudioBuffer(audioContext, threeByteBuffer, 24000);
      
      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(
        1,
        1, // 2 bytes / 2 bytes per sample = 1 sample
        24000
      );
    });
  });
});

