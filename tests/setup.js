/**
 * Jest Setup for dg_react_agent Tests
 * 
 * This file sets up mocks and global configurations for testing the dg_react_agent package.
 */

/* eslint-env jest */

// Mock WebSocket for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.send = jest.fn();
    this.close = jest.fn();
    
    // Simulate connection opening
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
  }
}

// Mock WebSocket globally
global.WebSocket = MockWebSocket;

// Mock AudioContext and related APIs
global.AudioContext = class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
  }
  
  createGain() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
      gain: { value: 1 }
    };
  }
  
  createMediaStreamSource() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn()
    };
  }
  
  createWorklet() {
    return Promise.resolve();
  }
  
  createBuffer() {
    return {
      getChannelData: jest.fn(() => new Float32Array(1024))
    };
  }
  
  createBufferSource() {
    return {
      buffer: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn()
    };
  }
  
  get destination() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn()
    };
  }
};

global.MediaStream = class MockMediaStream {
  constructor() {
    this.getTracks = () => [];
  }
};

global.MediaStreamTrack = class MockMediaStreamTrack {
  constructor(options = {}) {
    this.kind = options.kind || 'audio';
    this.label = options.label || 'Mock Track';
    this.enabled = true;
    this.muted = false;
    this.readyState = 'live';
  }
  
  stop() {
    this.readyState = 'ended';
  }
};

global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn().mockResolvedValue(new global.MediaStream())
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // log: jest.fn(),  // Temporarily disabled for debugging
  warn: jest.fn(),
  error: jest.fn()
};

// Add cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  // Clear any pending timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Setup timers before each test
beforeEach(() => {
  jest.useFakeTimers();
});
