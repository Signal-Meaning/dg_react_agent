/**
 * Audio Stream Mock Utilities for E2E Tests
 * 
 * This module provides centralized utilities for mocking audio streams
 * in Playwright tests to prevent ambient noise interference and ensure
 * consistent testing environments.
 */

/**
 * Audio Stream Mock Types
 */
const AUDIO_STREAM_TYPES = {
  SILENT: 'silent',           // Silent audio stream (0 Hz oscillator)
  MOCK: 'mock',              // Mock MediaStream with fake tracks
  REALISTIC: 'realistic',    // TTS-generated audio with silence
  DENIED: 'denied'           // Simulate microphone access denied
};

/**
 * Sets up a silent audio stream to prevent ambient noise interference
 * This is the most common pattern for VAD testing with pre-recorded audio
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {number} options.frequency - Oscillator frequency (0 = silent)
 * @param {boolean} options.preserveOriginal - Whether to preserve original getUserMedia
 */
async function setupSilentAudioStream(page, options = {}) {
  const { frequency = 0, preserveOriginal = true } = options;
  
  await page.addInitScript((freq) => {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints.audio) {
        // Return a silent audio stream for testing
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        const oscillator = audioContext.createOscillator();
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime); // Silent
        oscillator.connect(destination);
        oscillator.start();
        return destination.stream;
      }
      return preserveOriginal ? originalGetUserMedia.call(navigator.mediaDevices, constraints) : Promise.reject(new Error('Audio not requested'));
    };
  }, frequency);
}

/**
 * Sets up a mock MediaStream with fake audio tracks
 * Useful for testing microphone access without real audio processing
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeVideo - Whether to include video tracks
 * @param {string} options.trackLabel - Label for the mock track
 */
async function setupMockMediaStream(page, options = {}) {
  const { includeVideo = false, trackLabel = 'Mock Audio Track' } = options;
  
  await page.addInitScript((config) => {
    // Create mock MediaStreamTrack
    class MockMediaStreamTrack {
      constructor(kind) {
        this.kind = kind;
        this.enabled = true;
        this.id = `mock-${kind}-track-${Math.random().toString(36).substring(2, 11)}`;
        this.label = config.trackLabel;
        this.muted = false;
        this.readyState = 'live';
      }
      
      stop() {}
      addEventListener() {}
      removeEventListener() {}
      getSettings() { return {}; }
      getConstraints() { return {}; }
      getCapabilities() { return {}; }
      applyConstraints() { return Promise.resolve(); }
      clone() { return new MockMediaStreamTrack(this.kind); }
    }
    
    // Create mock MediaStream
    class MockMediaStream extends MediaStream {
      constructor() {
        super();
        this._tracks = [new MockMediaStreamTrack('audio')];
        if (config.includeVideo) {
          this._tracks.push(new MockMediaStreamTrack('video'));
        }
      }
      
      getTracks() { return this._tracks; }
      getAudioTracks() { return this._tracks.filter(t => t.kind === 'audio'); }
      getVideoTracks() { return this._tracks.filter(t => t.kind === 'video'); }
      addTrack(track) { this._tracks.push(track); }
      removeTrack(track) {
        const index = this._tracks.indexOf(track);
        if (index > -1) this._tracks.splice(index, 1);
      }
      clone() { return new MockMediaStream(); }
      getTrackById(id) { return this._tracks.find(track => track.id === id) || null; }
    }
    
    // Override getUserMedia
    navigator.mediaDevices.getUserMedia = () => {
      console.log('🎤 [MOCK] getUserMedia called - returning mock MediaStream');
      return Promise.resolve(new MockMediaStream());
    };
  }, { includeVideo, trackLabel });
}

/**
 * Simulates microphone access denied
 * Useful for testing error handling and permission flows
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} errorMessage - Custom error message
 */
async function setupMicrophoneDenied(page, errorMessage = 'Microphone access denied') {
  await page.addInitScript((msg) => {
    navigator.mediaDevices.getUserMedia = () => {
      return Promise.reject(new Error(msg));
    };
  }, errorMessage);
}

/**
 * Sets up comprehensive audio mocks including AudioContext and AudioWorklet
 * This is the most complete setup for complex audio testing scenarios
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {string} options.streamType - Type of audio stream to use
 * @param {boolean} options.mockAudioContext - Whether to mock AudioContext
 * @param {boolean} options.mockAudioWorklet - Whether to mock AudioWorklet
 */
async function setupComprehensiveAudioMocks(page, options = {}) {
  const { 
    streamType = AUDIO_STREAM_TYPES.SILENT,
    mockAudioContext = true,
    mockAudioWorklet = true 
  } = options;
  
  await page.addInitScript((config) => {
    // Setup audio stream based on type
    switch (config.streamType) {
      case 'silent':
        setupSilentAudioStream(page);
        break;
      case 'mock':
        setupMockMediaStream(page);
        break;
      case 'denied':
        setupMicrophoneDenied(page);
        break;
      default:
        setupSilentAudioStream(page);
    }
    
    // Mock AudioContext if requested
    if (config.mockAudioContext && window.AudioContext) {
      const originalAudioContext = window.AudioContext;
      window.AudioContext = class MockAudioContext extends originalAudioContext {
        constructor() {
          super();
          if (!Object.prototype.hasOwnProperty.call(this, 'audioWorklet')) {
            Object.defineProperty(this, 'audioWorklet', {
              value: {
                addModule: (url) => {
                  console.log('🎤 [MOCK] AudioWorklet.addModule called - simulating success');
                  return Promise.resolve();
                }
              },
              writable: false,
              enumerable: true,
              configurable: true
            });
          }
        }
        
        resume() {
          console.log('🎤 [MOCK] AudioContext.resume() called - allowing without user gesture');
          return Promise.resolve();
        }
        
        get state() { return 'running'; }
        
        createMediaStreamSource(stream) {
          console.log('🎤 [MOCK] createMediaStreamSource called - simulating success');
          return {
            connect: () => {},
            disconnect: () => {},
            context: this,
            mediaStream: stream,
            numberOfInputs: 0,
            numberOfOutputs: 1,
            channelCount: 1,
            channelCountMode: 'max',
            channelInterpretation: 'speakers'
          };
        }
      };
      
      window.webkitAudioContext = window.AudioContext;
    }
    
    // Mock AudioWorkletNode if requested
    if (config.mockAudioWorklet) {
      const originalAudioWorkletNode = window.AudioWorkletNode;
      window.AudioWorkletNode = class MockAudioWorkletNode {
        constructor(context, name, options) {
          console.log('🎤 [MOCK] AudioWorkletNode constructor called - simulating success');
          this.context = context;
          this.name = name;
          this.options = options;
          this.port = {
            postMessage: (data) => {
              console.log('🎤 [MOCK] AudioWorkletNode port.postMessage called with:', data);
            },
            onmessage: null
          };
          this.connect = () => {};
          this.disconnect = () => {};
          this.numberOfInputs = 1;
          this.numberOfOutputs = 1;
          this.channelCount = 1;
          this.channelCountMode = 'max';
          this.channelInterpretation = 'speakers';
        }
      };
    }
  }, { streamType, mockAudioContext, mockAudioWorklet });
}

/**
 * Convenience function for VAD testing with pre-recorded audio
 * This is the most common use case - silent stream + comprehensive mocks
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function setupVADTestingEnvironment(page) {
  await setupComprehensiveAudioMocks(page, {
    streamType: AUDIO_STREAM_TYPES.SILENT,
    mockAudioContext: true,
    mockAudioWorklet: true
  });
}

/**
 * Convenience function for microphone functionality testing
 * Uses mock MediaStream for testing UI interactions without real audio
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function setupMicrophoneTestingEnvironment(page) {
  await setupComprehensiveAudioMocks(page, {
    streamType: AUDIO_STREAM_TYPES.MOCK,
    mockAudioContext: true,
    mockAudioWorklet: true
  });
}

/**
 * Convenience function for testing permission denied scenarios
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function setupPermissionDeniedEnvironment(page) {
  await setupComprehensiveAudioMocks(page, {
    streamType: AUDIO_STREAM_TYPES.DENIED,
    mockAudioContext: false,
    mockAudioWorklet: false
  });
}

export {
  AUDIO_STREAM_TYPES,
  setupSilentAudioStream,
  setupMockMediaStream,
  setupMicrophoneDenied,
  setupComprehensiveAudioMocks,
  setupVADTestingEnvironment,
  setupMicrophoneTestingEnvironment,
  setupPermissionDeniedEnvironment
};
