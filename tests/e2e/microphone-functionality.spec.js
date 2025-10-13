const { test, expect } = require('@playwright/test');
const { setupTestPage } = require('./helpers/audio-mocks');

/**
 * Microphone Functionality Test
 * 
 * This test actually verifies that the microphone button enables recording
 * and that the microphone state changes correctly.
 */

test.describe('Microphone Functionality Tests', () => {
  test('should actually enable microphone when button is clicked', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
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
            // Override the read-only audioWorklet property
            Object.defineProperty(this, 'audioWorklet', {
              value: {
                addModule: (url) => {
                  console.log('🎤 [MOCK] AudioWorklet.addModule called - simulating success');
                  return Promise.resolve();
                }
              },
              writable: false,
              enumerable: true,
              configurable: false
            });
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
      }
      
      // Also mock webkitAudioContext
      if (window.webkitAudioContext) {
        const originalWebkitAudioContext = window.webkitAudioContext;
        window.webkitAudioContext = class MockWebkitAudioContext extends originalWebkitAudioContext {
          constructor() {
            super();
            // Override the read-only audioWorklet property
            Object.defineProperty(this, 'audioWorklet', {
              value: {
                addModule: (url) => {
                  console.log('🎤 [MOCK] AudioWorklet.addModule called - simulating success');
                  return Promise.resolve();
                }
              },
              writable: false,
              enumerable: true,
              configurable: false
            });
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
      }
      
      // Mock AudioWorkletNode constructor to prevent AudioWorkletGlobalScope errors
      if (window.AudioWorkletNode) {
        const originalAudioWorkletNode = window.AudioWorkletNode;
        window.AudioWorkletNode = class MockAudioWorkletNode extends originalAudioWorkletNode {
          constructor(context, name, options = {}) {
            console.log('🎤 [MOCK] AudioWorkletNode constructor called - simulating success');
            // Create a mock AudioWorkletNode that doesn't require AudioWorkletGlobalScope
            const mockNode = {
              connect: () => {},
              disconnect: () => {},
              context: context,
              name: name,
              numberOfInputs: 1,
              numberOfOutputs: 1,
              channelCount: 1,
              channelCountMode: 'max',
              channelInterpretation: 'speakers',
              port: {
                postMessage: () => {},
                onmessage: null,
                addEventListener: () => {},
                removeEventListener: () => {},
                close: () => {}
              }
            };
            return mockNode;
          }
        };
      }
    });
    
    // Capture console logs from the beginning
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Navigate to test app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for connection to be established
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Check initial microphone state
    const initialMicStatus = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Initial mic status:', initialMicStatus);
    
    // Click microphone button
    await page.click('[data-testid="microphone-button"]');
    
    // Wait a bit for the microphone to be enabled
    await page.waitForTimeout(3000);
    
    // Check if microphone status changed
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // Display all console logs for debugging
    console.log('\n=== CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));
    console.log('=== END CONSOLE LOGS ===\n');
    
    // Look for specific debugging messages
    const toggleMicLogs = consoleLogs.filter(log => log.includes('[toggleMic]'));
    const settingsLogs = consoleLogs.filter(log => log.includes('[sendAgentSettings]'));
    const hasSentSettingsLogs = consoleLogs.filter(log => log.includes('hasSentSettings'));
    
    console.log('\n=== TOGGLE MIC LOGS ===');
    toggleMicLogs.forEach(log => console.log(log));
    console.log('=== END TOGGLE MIC LOGS ===\n');
    
    console.log('\n=== SETTINGS LOGS ===');
    settingsLogs.forEach(log => console.log(log));
    console.log('=== END SETTINGS LOGS ===\n');
    
    console.log('\n=== HAS SENT SETTINGS LOGS ===');
    hasSentSettingsLogs.forEach(log => console.log(log));
    console.log('=== END HAS SENT SETTINGS LOGS ===\n');
    
    // Verify microphone is enabled
    expect(micStatusAfterClick).toBe('Enabled');
    
    console.log('Test completed - microphone should be enabled');
  });
  
  test('should show VAD elements when microphone is enabled', async ({ page }) => {
    // Navigate to test app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for microphone to be enabled
    await page.waitForTimeout(2000);
    
    // Verify VAD elements are visible
    await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-speaking"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-stopped-speaking"]')).toBeVisible();
    await expect(page.locator('[data-testid="utterance-end"]')).toBeVisible();
    await expect(page.locator('[data-testid="vad-event"]')).toBeVisible();
    
    // Check initial VAD states
    const userSpeaking = await page.locator('[data-testid="user-speaking"]').textContent();
    expect(userSpeaking).toBe('false');
    
    console.log('VAD elements verified - microphone should be ready for audio input');
  });

  test('should verify transcription setup happens during initialization', async ({ page }) => {
    // Capture console logs from the beginning
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Navigate to test app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for connection to be established
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait a bit more for all initialization to complete
    await page.waitForTimeout(2000);
    
    // Filter for transcription setup logs
    const transcriptionSetupLogs = consoleLogs.filter(log => 
      log.includes('[TRANSCRIPTION] Starting transcription setup') ||
      log.includes('VAD: utterance_end_ms set to') ||
      log.includes('VAD: interim_results set to') ||
      log.includes('Final transcription URL:')
    );
    
    // Filter for VAD configuration specifically
    const vadConfigLogs = consoleLogs.filter(log => 
      log.includes('VAD: utterance_end_ms set to 1000ms') ||
      log.includes('VAD: interim_results set to true')
    );
    
    // Display all console logs for debugging
    console.log('\n=== ALL CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));
    console.log('=== END CONSOLE LOGS ===\n');
    
    // Display transcription setup logs
    console.log('\n=== TRANSCRIPTION SETUP LOGS ===');
    transcriptionSetupLogs.forEach(log => console.log(log));
    console.log('=== END TRANSCRIPTION SETUP LOGS ===\n');
    
    // Display VAD configuration logs
    console.log('\n=== VAD CONFIGURATION LOGS ===');
    vadConfigLogs.forEach(log => console.log(log));
    console.log('=== END VAD CONFIGURATION LOGS ===\n');
    
    // Check for component initialization mode
    const dualModeLogs = consoleLogs.filter(log => 
      log.includes('Initializing in DUAL MODE')
    );
    
    console.log('\n=== COMPONENT MODE LOGS ===');
    dualModeLogs.forEach(log => console.log(log));
    console.log('=== END COMPONENT MODE LOGS ===\n');
    
    // Verify component is in dual mode
    expect(dualModeLogs.length).toBeGreaterThan(0);
    
    // This is the critical test - transcription setup should happen
    if (transcriptionSetupLogs.length === 0) {
      console.log('❌ FAILURE: No transcription setup logs found!');
      console.log('This means transcriptionOptions is not being passed to the component.');
      console.log('Expected logs:');
      console.log('  - [TRANSCRIPTION] Starting transcription setup');
      console.log('  - VAD: utterance_end_ms set to 1000ms');
      console.log('  - VAD: interim_results set to true');
      console.log('  - Final transcription URL: [URL with VAD parameters]');
    }
    
    // Verify transcription setup happened
    expect(transcriptionSetupLogs.length).toBeGreaterThan(0);
    
    // Specifically check for VAD configuration
    expect(vadConfigLogs.length).toBeGreaterThan(0);
    
    console.log('✅ SUCCESS: Transcription setup verified');
  });
});
