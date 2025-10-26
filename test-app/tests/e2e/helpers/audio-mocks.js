/**
 * Shared Audio Mock Utilities for E2E Tests
 * 
 * This module provides reusable audio mocks for Playwright tests
 * to simulate microphone functionality without requiring real audio APIs.
 */

/**
 * Sets up comprehensive audio mocks for a Playwright page
 * @param {import('@playwright/test').Page} page - The Playwright page instance
 */
async function setupAudioMocks(page) {
  await page.addInitScript(() => {
    // Create a proper MediaStream mock that AudioContext will accept
    class MockMediaStreamTrack {
      constructor(kind) {
        this.kind = kind;
        this.enabled = true;
        this.id = `mock-${kind}-track-${Math.random().toString(36).substr(2, 9)}`;
        this.label = `Mock ${kind} Track`;
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
    
    class MockMediaStream extends MediaStream {
      constructor() {
        super();
        this._tracks = [new MockMediaStreamTrack('audio')];
      }
      
      getTracks() {
        return this._tracks;
      }
      
      getAudioTracks() {
        return this._tracks;
      }
      
      getVideoTracks() {
        return [];
      }
      
      addTrack(track) {
        this._tracks.push(track);
      }
      
      removeTrack(track) {
        const index = this._tracks.indexOf(track);
        if (index > -1) {
          this._tracks.splice(index, 1);
        }
      }
      
      clone() {
        return new MockMediaStream();
      }
      
      getTrackById(id) {
        return this._tracks.find(track => track.id === id) || null;
      }
    }
    
    // Override getUserMedia to return mock stream immediately
    navigator.mediaDevices.getUserMedia = () => {
      console.log('🎤 [MOCK] getUserMedia called - returning mock MediaStream');
      return Promise.resolve(new MockMediaStream());
    };
    
    // Mock AudioWorklet and createMediaStreamSource to prevent hanging
    if (window.AudioContext) {
      const originalAudioContext = window.AudioContext;
      window.AudioContext = class MockAudioContext extends originalAudioContext {
        constructor() {
          super();
          // Override the read-only audioWorklet property only if not already defined
          if (!this.hasOwnProperty('audioWorklet')) {
            Object.defineProperty(this, 'audioWorklet', {
              value: {
                addModule: (url) => {
                  console.log('🎤 [MOCK] AudioWorklet.addModule called - simulating success');
                  return Promise.resolve();
                }
              },
              writable: false,
              enumerable: true,
              configurable: true // Allow redefinition to prevent errors
            });
          }
        }
        
        // Override resume to always succeed (bypass user gesture requirement)
        resume() {
          console.log('🎤 [MOCK] AudioContext.resume() called - allowing without user gesture');
          return Promise.resolve();
        }
        
        // Override state to always return 'running' (bypass suspended state)
        get state() {
          return 'running';
        }
        
        // Mock createMediaStreamSource to bypass MediaStream validation
        createMediaStreamSource(stream) {
          console.log('🎤 [MOCK] createMediaStreamSource called - simulating success');
          // Return a mock MediaStreamAudioSourceNode
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
      
      // Also override webkitAudioContext
      window.webkitAudioContext = window.AudioContext;
    }
    
    // Mock AudioWorkletNode constructor to prevent hanging
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
  });
}

/**
 * Sets up a test page with audio mocks and navigates to the test app
 * @param {import('@playwright/test').Page} page - The Playwright page instance
 */
async function setupTestPage(page) {
  await setupAudioMocks(page);
  
  // Navigate to test app with debug mode enabled
  await page.goto('http://localhost:5173/?debug=true');
  await page.waitForLoadState('networkidle');
  
  // Wait for component to initialize
  await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  
  // Wait for connection to be established
  await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
  
  // Simulate user gesture to enable AudioContext
  await page.evaluate(() => {
    // Create a temporary audio context to trigger user gesture requirement
    const tempContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Resume the context to simulate user interaction
    if (tempContext.state === 'suspended') {
      return tempContext.resume().then(() => {
        console.log('✅ AudioContext resumed for test setup');
        tempContext.close();
      });
    } else {
      console.log('✅ AudioContext already running');
      tempContext.close();
      return Promise.resolve();
    }
  });
  
  // Wait a bit for AudioContext to be ready
  await page.waitForTimeout(500);
}

/**
 * Simulates a user gesture to enable AudioContext
 * @param {import('@playwright/test').Page} page - The Playwright page instance
 */
async function simulateUserGesture(page) {
  await page.evaluate(() => {
    // Trigger a user gesture by creating and interacting with an audio context
    const context = new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') {
      return context.resume().then(() => {
        console.log('✅ User gesture simulated - AudioContext resumed');
        context.close();
      });
    } else {
      console.log('✅ User gesture simulated - AudioContext already running');
      context.close();
      return Promise.resolve();
    }
  });
}

/**
 * Simulates audio data being sent to Deepgram
 * @param {import('@playwright/test').Page} page - The Playwright page instance
 * @param {string} description - Description of the simulated speech
 * @param {Object} options - Simulation options
 * @param {boolean} options.useRealisticAudio - Use TTS-generated audio instead of empty buffer
 * @param {string} options.phrase - Text to speak (if using realistic audio)
 */
async function simulateSpeech(page, description = 'simulated speech', options = {}) {
  const { useRealisticAudio = false, phrase = 'Hello' } = options;
  
  if (useRealisticAudio) {
    // Use VAD Audio Simulator for realistic speech
    const AudioSimulator = require('../../utils/audio-simulator');
    await AudioSimulator.simulateSpeech(page, phrase, {
      silenceDuration: 1000,
      onsetSilence: 300
    });
    console.log(`🎤 [TEST] Simulated realistic speech: ${phrase}`);
  } else {
    // Legacy empty buffer simulation
    await page.evaluate((desc) => {
      // Simulate audio data being sent to Deepgram
      // This mimics what happens when the AudioWorkletNode processes audio
      const audioData = new ArrayBuffer(8192);
      
      // Find the DeepgramVoiceInteraction component and trigger audio data
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        console.log(`🎤 [TEST] Sending simulated audio data to Deepgram: ${desc}`);
        deepgramComponent.sendAudioData(audioData);
      } else {
        console.log('🎤 [TEST] DeepgramVoiceInteraction not found or sendAudioData not available');
        console.log('🎤 [TEST] window.deepgramRef:', !!window.deepgramRef);
        console.log('🎤 [TEST] window.deepgramRef.current:', !!window.deepgramRef?.current);
        if (window.deepgramRef?.current) {
          console.log('🎤 [TEST] Available methods:', Object.keys(window.deepgramRef.current));
        }
      }
    }, description);
  }
}

export {
  setupAudioMocks,
  setupTestPage,
  simulateUserGesture,
  simulateSpeech
};
