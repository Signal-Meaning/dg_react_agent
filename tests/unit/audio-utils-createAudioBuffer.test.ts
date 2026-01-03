/**
 * Unit Test: AudioUtils createAudioBuffer() - Issue #340 Fix
 * 
 * Tests the fix for odd-length audio buffer handling:
 * - Validates buffer length before creating Int16Array
 * - Truncates odd-length buffers to even length
 * - Logs warning when truncation occurs
 * - Prevents RangeError when processing TTS audio
 */

import { createAudioBuffer } from '../../src/utils/audio/AudioUtils';

// Mock AudioContext and related Web Audio API
const mockChannelData = new Float32Array(1000);

const mockAudioContext = {
  createBuffer: jest.fn((channels, length, sampleRate) => ({
    length,
    sampleRate,
    duration: length / sampleRate,
    numberOfChannels: channels,
    getChannelData: jest.fn((channelIndex) => {
      if (channelIndex === 0) {
        return mockChannelData.slice(0, length);
      }
      throw new Error(`Invalid channel index: ${channelIndex}`);
    })
  })),
  destination: {},
  state: 'running'
};

// Mock Web Audio API
global.AudioContext = jest.fn(() => mockAudioContext) as any;

describe('AudioUtils createAudioBuffer() - Issue #340 Fix', () => {
  let audioContext: AudioContext;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create fresh AudioContext instance
    audioContext = new AudioContext();
    
    // Spy on console.warn to capture truncation warnings
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Even-Length Buffer Handling (Normal Case)', () => {
    test('should create AudioBuffer from even-length ArrayBuffer', () => {
      // Create even-length buffer (1000 bytes = 500 samples)
      const evenLengthData = new ArrayBuffer(1000);
      const int16Data = new Int16Array(evenLengthData);
      // Fill with test data
      for (let i = 0; i < int16Data.length; i++) {
        int16Data[i] = i % 32768;
      }

      const result = createAudioBuffer(audioContext, evenLengthData, 24000);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 500, 24000);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should handle standard PCM16 buffer size (960 bytes)', () => {
      // 960 bytes = 480 samples (common Deepgram buffer size)
      const standardBuffer = new ArrayBuffer(960);
      const int16Data = new Int16Array(standardBuffer);
      for (let i = 0; i < int16Data.length; i++) {
        int16Data[i] = 1000;
      }

      const result = createAudioBuffer(audioContext, standardBuffer, 24000);

      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 480, 24000);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Odd-Length Buffer Handling (Issue #340 Fix)', () => {
    test('should truncate odd-length buffer to even length', () => {
      // Create odd-length buffer (1001 bytes)
      const oddLengthData = new ArrayBuffer(1001);
      const int16Data = new Int16Array(oddLengthData.slice(0, 1000)); // Fill first 1000 bytes
      for (let i = 0; i < int16Data.length; i++) {
        int16Data[i] = i % 32768;
      }

      const result = createAudioBuffer(audioContext, oddLengthData, 24000);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Should create buffer with 500 samples (1000 bytes / 2)
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 500, 24000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio buffer had odd length (1001 bytes)')
      );
    });

    test('should handle 1-byte buffer (minimum odd length)', () => {
      // Create 1-byte buffer (minimum odd length)
      const oneByteData = new ArrayBuffer(1);
      new Uint8Array(oneByteData)[0] = 0x00;

      const result = createAudioBuffer(audioContext, oneByteData, 24000);

      // Should truncate to 0 bytes, which should return undefined (empty buffer)
      expect(result).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio buffer had odd length (1 bytes)')
      );
    });

    test('should handle 3-byte buffer', () => {
      // Create 3-byte buffer
      const threeByteData = new ArrayBuffer(3);
      const uint8Data = new Uint8Array(threeByteData);
      uint8Data[0] = 0x00;
      uint8Data[1] = 0x01;
      uint8Data[2] = 0x02;

      const result = createAudioBuffer(audioContext, threeByteData, 24000);

      // Should truncate to 2 bytes = 1 sample
      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 1, 24000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio buffer had odd length (3 bytes)')
      );
    });

    test('should handle 999-byte buffer', () => {
      // Create 999-byte buffer
      const oddLengthData = new ArrayBuffer(999);
      const int16Data = new Int16Array(oddLengthData.slice(0, 998)); // Fill first 998 bytes
      for (let i = 0; i < int16Data.length; i++) {
        int16Data[i] = i % 32768;
      }

      const result = createAudioBuffer(audioContext, oddLengthData, 24000);

      // Should truncate to 998 bytes = 499 samples
      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 499, 24000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio buffer had odd length (999 bytes)')
      );
    });

    test('should not throw RangeError with odd-length buffer', () => {
      // Create odd-length buffer that would cause RangeError without fix
      const oddLengthData = new ArrayBuffer(1001);
      new Uint8Array(oddLengthData).fill(0);

      // Should not throw RangeError
      expect(() => {
        createAudioBuffer(audioContext, oddLengthData, 24000);
      }).not.toThrow(RangeError);
    });
  });

  describe('Edge Cases', () => {
    test('should return undefined for empty buffer', () => {
      const emptyData = new ArrayBuffer(0);

      const result = createAudioBuffer(audioContext, emptyData, 24000);

      expect(result).toBeUndefined();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should handle custom sample rate', () => {
      const evenLengthData = new ArrayBuffer(1000);
      const int16Data = new Int16Array(evenLengthData);
      for (let i = 0; i < int16Data.length; i++) {
        int16Data[i] = 1000;
      }

      const result = createAudioBuffer(audioContext, evenLengthData, 16000);

      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 500, 16000);
    });

    test('should handle very large even-length buffer', () => {
      // 1MB buffer = 524,288 samples
      const largeBuffer = new ArrayBuffer(1048576);
      const int16Data = new Int16Array(largeBuffer);
      for (let i = 0; i < int16Data.length; i++) {
        int16Data[i] = i % 32768;
      }

      const result = createAudioBuffer(audioContext, largeBuffer, 24000);

      expect(result).toBeDefined();
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 524288, 24000);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should handle very large odd-length buffer', () => {
      // 1MB + 1 byte buffer
      const largeOddBuffer = new ArrayBuffer(1048577);
      const int16Data = new Int16Array(largeOddBuffer.slice(0, 1048576));
      for (let i = 0; i < int16Data.length; i++) {
        int16Data[i] = i % 32768;
      }

      const result = createAudioBuffer(audioContext, largeOddBuffer, 24000);

      expect(result).toBeDefined();
      // Should truncate to 1MB = 524,288 samples
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 524288, 24000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audio buffer had odd length (1048577 bytes)')
      );
    });
  });

  describe('Data Conversion', () => {
    test('should create buffer with correct sample count for Int16 PCM data', () => {
      const evenLengthData = new ArrayBuffer(4); // 2 samples (4 bytes / 2 bytes per sample)
      const int16Data = new Int16Array(evenLengthData);
      int16Data[0] = 32767; // Max positive value
      int16Data[1] = -32768; // Max negative value

      const result = createAudioBuffer(audioContext, evenLengthData, 24000);

      expect(result).toBeDefined();
      // Verify buffer was created with correct number of samples (2 samples from 4 bytes)
      expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 2, 24000);
      // Verify getChannelData was called (indicating conversion loop executed)
      expect(result!.getChannelData).toHaveBeenCalledWith(0);
    });
  });
});

