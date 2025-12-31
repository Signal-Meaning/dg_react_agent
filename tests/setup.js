/**
 * Jest Setup for dg_react_agent Tests
 * 
 * This file sets up mocks and global configurations for testing the dg_react_agent package.
 */

/* eslint-env jest */

// Load environment variables from .env file for all tests
require('dotenv').config();

// Determine if we should use real WebSocket or mock
// Note: If using custom-jsdom-env.js, WebSocket is already set by the environment
// This setup.js override is only needed for standard jsdom environment
const isRealAPITesting = !!process.env.DEEPGRAM_API_KEY && 
                        process.env.DEEPGRAM_API_KEY !== 'mock' &&
                        process.env.CI !== 'true';

// Only override WebSocket if NOT using custom environment (which handles it)
// Custom environment is detected by checking if WebSocket is already the 'ws' library
const isUsingCustomEnv = global.WebSocket && global.WebSocket.name === 'WebSocket' && 
                         global.WebSocket.toString().includes('[native code]') === false;

if (!isUsingCustomEnv) {
  if (isRealAPITesting) {
    // Use real WebSocket for testing (Node.js 'ws' library)
    // This allows Jest tests to validate actual Deepgram API connectivity
    // Note: Audio features are still mocked (jsdom limitation)
    try {
      const WebSocket = require('ws');
      global.WebSocket = WebSocket;
      console.log('✅ Using real WebSocket for Jest tests (DEEPGRAM_API_KEY detected)');
    } catch (error) {
      console.warn('⚠️  ws package not found, falling back to MockWebSocket');
      // Fall back to mock if ws is not available
      const MockWebSocket = createMockWebSocket();
      global.WebSocket = MockWebSocket;
    }
  } else {
    // Use mock WebSocket when no API key is provided
    const MockWebSocket = createMockWebSocket();
    global.WebSocket = MockWebSocket;
  }
} else {
  console.log('✅ Using custom jsdom environment with real WebSocket');
}

// Mock WebSocket for testing
function createMockWebSocket() {
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
  return MockWebSocket;
}

// Mock AudioContext and related APIs
global.AudioContext = class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
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
      duration: 1.0,
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
  
  close() {
    this.state = 'closed';
    return Promise.resolve();
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
