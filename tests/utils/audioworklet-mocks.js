/**
 * AudioWorklet mocks for testing the dg_react_agent package
 * This file provides mocks for AudioWorklet functionality that may not be available in test environments
 */

/**
 * Sets up AudioWorklet mocks for Playwright tests
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function setupAudioWorkletMocksForTest(page) {
  // Mock AudioWorklet functionality
  await page.addInitScript(() => {
    // Mock AudioWorkletNode
    if (!window.AudioWorkletNode) {
      window.AudioWorkletNode = class MockAudioWorkletNode {
        constructor(context, options = {}) {
          this.context = context;
          this.options = options;
          this.port = {
            postMessage: () => {},
            onmessage: null
          };
          this.connected = false;
          this.numberOfInputs = 1;
          this.numberOfOutputs = 1;
          this.channelCount = 1;
          this.channelCountMode = 'max';
          this.channelInterpretation = 'speakers';
        }

        connect(destination) {
          this.connected = true;
          return this;
        }

        disconnect() {
          this.connected = false;
        }

        addEventListener(type, listener) {
          // Mock event listener
        }

        removeEventListener(type, listener) {
          // Mock event listener removal
        }
      };
    }

    // Mock AudioWorklet
    if (!window.AudioWorklet) {
      window.AudioWorklet = class MockAudioWorklet {
        constructor() {
          this.port = {
            postMessage: () => {},
            onmessage: null
          };
        }

        addModule(moduleURL) {
          return new Promise((resolve) => {
            // Simulate async module loading
            setTimeout(() => {
              console.log(`[MockAudioWorklet] Module loaded: ${moduleURL}`);
              resolve();
            }, 100);
          });
        }
      };
    }

    // Mock AudioContext.createWorklet
    const originalCreateWorklet = AudioContext.prototype.createWorklet;
    AudioContext.prototype.createWorklet = function() {
      return new window.AudioWorklet();
    };

    // Mock AudioBuffer for testing
    if (!window.AudioBuffer) {
      window.AudioBuffer = class MockAudioBuffer {
        constructor(options) {
          this.length = options.length || 0;
          this.duration = options.duration || 0;
          this.sampleRate = options.sampleRate || 44100;
          this.numberOfChannels = options.numberOfChannels || 1;
          this.channels = new Array(this.numberOfChannels).fill(null).map(() => 
            new Float32Array(this.length)
          );
        }

        getChannelData(channel) {
          return this.channels[channel] || new Float32Array(0);
        }

        copyFromChannel(destination, channelNumber, startInChannel = 0) {
          const source = this.getChannelData(channelNumber);
          const length = Math.min(destination.length, source.length - startInChannel);
          for (let i = 0; i < length; i++) {
            destination[i] = source[i + startInChannel];
          }
        }

        copyToChannel(source, channelNumber, startInChannel = 0) {
          const destination = this.getChannelData(channelNumber);
          const length = Math.min(source.length, destination.length - startInChannel);
          for (let i = 0; i < length; i++) {
            destination[i + startInChannel] = source[i];
          }
        }
      };
    }

    // Mock MediaStream for testing
    if (!window.MediaStream) {
      window.MediaStream = class MockMediaStream {
        constructor(tracks = []) {
          this.tracks = tracks;
          this.active = true;
        }

        getTracks() {
          return this.tracks;
        }

        getAudioTracks() {
          return this.tracks.filter(track => track.kind === 'audio');
        }

        addTrack(track) {
          this.tracks.push(track);
        }

        removeTrack(track) {
          const index = this.tracks.indexOf(track);
          if (index > -1) {
            this.tracks.splice(index, 1);
          }
        }
      };
    }

    // Mock MediaStreamTrack
    if (!window.MediaStreamTrack) {
      window.MediaStreamTrack = class MockMediaStreamTrack {
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
    }

    // Mock getUserMedia
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        console.log('[MockGetUserMedia] Requested constraints:', constraints);
        
        // Create a mock audio track
        const audioTrack = new window.MediaStreamTrack({
          kind: 'audio',
          label: 'Mock Audio Track'
        });

        // Create a mock media stream
        const stream = new window.MediaStream([audioTrack]);
        
        return stream;
      };
    }

    // Mock AudioContext methods that might be missing
    if (AudioContext.prototype.createBuffer) {
      const originalCreateBuffer = AudioContext.prototype.createBuffer;
      AudioContext.prototype.createBuffer = function(channels, length, sampleRate) {
        return new window.AudioBuffer({
          numberOfChannels: channels,
          length: length,
          sampleRate: sampleRate
        });
      };
    }

    console.log('[AudioWorkletMocks] All mocks initialized successfully');
  });
}

/**
 * Creates a mock AudioWorklet module for testing
 * @param {string} moduleName - Name of the module
 * @returns {string} - Mock module code
 */
export function createMockAudioWorkletModule(moduleName) {
  return `
    class ${moduleName} extends AudioWorkletProcessor {
      constructor() {
        super();
        this.port.onmessage = (event) => {
          console.log('[${moduleName}] Message received:', event.data);
        };
      }

      process(inputs, outputs, parameters) {
        // Mock processing - just pass through
        const input = inputs[0];
        const output = outputs[0];
        
        if (input && output) {
          for (let channel = 0; channel < input.length; channel++) {
            if (input[channel] && output[channel]) {
              output[channel].set(input[channel]);
            }
          }
        }
        
        return true; // Keep processor alive
      }
    }

    registerProcessor('${moduleName}', ${moduleName});
  `;
}

/**
 * Creates a mock AudioBuffer for testing
 * @param {Object} options - Buffer options
 * @returns {AudioBuffer} - Mock AudioBuffer
 */
export function createMockAudioBuffer(options = {}) {
  return new window.AudioBuffer({
    length: options.length || 1024,
    duration: options.duration || 0.023,
    sampleRate: options.sampleRate || 44100,
    numberOfChannels: options.numberOfChannels || 1
  });
}

/**
 * Creates a mock MediaStream for testing
 * @param {Object} options - Stream options
 * @returns {MediaStream} - Mock MediaStream
 */
export function createMockMediaStream(options = {}) {
  const tracks = [];
  
  if (options.audio !== false) {
    tracks.push(new window.MediaStreamTrack({
      kind: 'audio',
      label: 'Mock Audio Track'
    }));
  }
  
  if (options.video) {
    tracks.push(new window.MediaStreamTrack({
      kind: 'video',
      label: 'Mock Video Track'
    }));
  }
  
  return new window.MediaStream(tracks);
}
