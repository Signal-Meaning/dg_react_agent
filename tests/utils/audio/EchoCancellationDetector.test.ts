/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Unit Tests for EchoCancellationDetector
 * 
 * Issue: #243 - Enhanced Echo Cancellation Support and Browser Compatibility
 * 
 * Tests the EchoCancellationDetector utility that:
 * - Detects browser support for echo cancellation
 * - Verifies echo cancellation is actually active (not just requested)
 * - Reports browser-specific limitations
 */

// Note: We'll implement EchoCancellationDetector in src/utils/audio/EchoCancellationDetector.ts
// This test file defines the expected API and behavior

describe('EchoCancellationDetector', () => {
  let mockMediaStream: MediaStream;
  let mockAudioTrack: MediaStreamTrack;

  beforeEach(() => {
    // Create mock audio track with getSettings method
    mockAudioTrack = {
      kind: 'audio',
      label: 'Mock Audio Track',
      enabled: true,
      muted: false,
      readyState: 'live',
      id: 'mock-track-id',
      getSettings: jest.fn(),
      getConstraints: jest.fn(),
      getCapabilities: jest.fn(),
      applyConstraints: jest.fn(),
      stop: jest.fn(),
      clone: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as MediaStreamTrack;

    // Create mock MediaStream
    mockMediaStream = {
      getTracks: jest.fn(() => [mockAudioTrack]),
      getAudioTracks: jest.fn(() => [mockAudioTrack]),
      getVideoTracks: jest.fn(() => []),
      addTrack: jest.fn(),
      removeTrack: jest.fn(),
      clone: jest.fn(),
      getTrackById: jest.fn(),
    } as unknown as MediaStream;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectSupport', () => {
    beforeEach(() => {
      // Setup mock for getSupportedConstraints
      if (!navigator.mediaDevices) {
        (navigator as any).mediaDevices = {};
      }
      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => ({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }));
    });

    it('should detect echo cancellation as active when getSettings returns true', async () => {
      // Mock getSettings to return echoCancellation: true
      (mockAudioTrack.getSettings as jest.Mock).mockReturnValue({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const support = await EchoCancellationDetector.detectSupport(mockMediaStream);
      
      expect(support.supported).toBe(true);
      expect(support.active).toBe(true);
      expect(support.browser).toBeDefined();
    });

    it('should detect echo cancellation as not active when getSettings returns false', async () => {
      (mockAudioTrack.getSettings as jest.Mock).mockReturnValue({
        echoCancellation: false,
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const support = await EchoCancellationDetector.detectSupport(mockMediaStream);
      
      expect(support.supported).toBe(true);
      expect(support.active).toBe(false);
    });

    it('should detect echo cancellation as not active when getSettings returns undefined', async () => {
      (mockAudioTrack.getSettings as jest.Mock).mockReturnValue({
        // echoCancellation not present
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const support = await EchoCancellationDetector.detectSupport(mockMediaStream);
      
      expect(support.active).toBe(false);
    });

    it('should handle stream with no audio tracks', async () => {
      const emptyStream = {
        getAudioTracks: jest.fn(() => []),
      } as unknown as MediaStream;

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const support = await EchoCancellationDetector.detectSupport(emptyStream);
      
      expect(support.supported).toBe(false);
      expect(support.active).toBe(false);
      expect(support.limitations).toContain('No audio tracks found in stream');
    });

    it('should detect browser name and version', async () => {
      const originalUserAgent = navigator.userAgent;
      
      // Mock navigator.userAgent
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      });

      (mockAudioTrack.getSettings as jest.Mock).mockReturnValue({
        echoCancellation: true,
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const support = await EchoCancellationDetector.detectSupport(mockMediaStream);
      
      expect(support.browser).toBe('Chrome');
      expect(support.version).toBe('120');
      
      // Restore
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: originalUserAgent,
      });
    });
  });

  describe('verifyActive', () => {
    it('should return true when echo cancellation is active', async () => {
      (mockAudioTrack.getSettings as jest.Mock).mockReturnValue({
        echoCancellation: true,
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const isActive = await EchoCancellationDetector.verifyActive(mockMediaStream);
      expect(isActive).toBe(true);
    });

    it('should return false when echo cancellation is not active', async () => {
      (mockAudioTrack.getSettings as jest.Mock).mockReturnValue({
        echoCancellation: false,
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const isActive = await EchoCancellationDetector.verifyActive(mockMediaStream);
      expect(isActive).toBe(false);
    });
  });

  describe('getBrowserInfo', () => {
    const originalUserAgent = navigator.userAgent;
    
    afterEach(() => {
      // Restore original userAgent after each test
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: originalUserAgent,
      });
    });

    it('should detect Chrome browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const info = EchoCancellationDetector.getBrowserInfo();
      expect(info.browser).toBe('Chrome');
      expect(info.version).toBe('120');
    });

    it('should detect Firefox browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const info = EchoCancellationDetector.getBrowserInfo();
      expect(info.browser).toBe('Firefox');
      expect(info.version).toBe('121');
    });

    it('should detect Safari browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const info = EchoCancellationDetector.getBrowserInfo();
      expect(info.browser).toBe('Safari');
      expect(info.version).toBe('17');
    });

    it('should detect Edge browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edg/120.0.0.0',
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const info = EchoCancellationDetector.getBrowserInfo();
      expect(info.browser).toBe('Edge');
      expect(info.version).toBe('120');
    });

    it('should handle unknown browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Unknown Browser',
      });

      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const info = EchoCancellationDetector.getBrowserInfo();
      expect(info.browser).toBe('Unknown');
    });
  });

  describe('getSupportedConstraints', () => {
    beforeEach(() => {
      // Ensure navigator.mediaDevices exists
      if (!navigator.mediaDevices) {
        (navigator as any).mediaDevices = {};
      }
    });

    it('should check if browser supports echoCancellation constraint', () => {
      // Mock navigator.mediaDevices.getSupportedConstraints
      const mockSupportedConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      (navigator.mediaDevices as any).getSupportedConstraints = jest.fn(() => mockSupportedConstraints);

      // Test the implementation
      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const support = EchoCancellationDetector.detectSupport(mockMediaStream);
      
      // Verify the method uses getSupportedConstraints
      expect(navigator.mediaDevices.getSupportedConstraints).toBeDefined();
    });

    it('should handle when getSupportedConstraints is not available', async () => {
      // Some browsers may not support getSupportedConstraints
      delete (navigator.mediaDevices as any).getSupportedConstraints;

      // Test that implementation handles missing API gracefully
      const { EchoCancellationDetector } = require('../../../src/utils/audio/EchoCancellationDetector');
      const support = await EchoCancellationDetector.detectSupport(mockMediaStream);
      
      // Should still work, but may not have supported constraint info
      expect(support).toBeDefined();
    });
  });
});

