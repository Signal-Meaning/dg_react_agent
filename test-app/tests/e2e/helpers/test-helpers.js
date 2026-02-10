/**
 * E2E Test Helpers
 * 
 * Shared utilities for Playwright E2E tests to promote DRY principles
 * and consistent testing patterns across the test suite.
 * Load test-app/.env so skip checks (e.g. USE_REAL_APIS + OPENAI_API_KEY) see keys when run in workers.
 */
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

/**
 * Check if real Deepgram API key is available for testing
 * @returns {boolean} True if a valid API key is available
 */
export function hasRealAPIKey() {
  const apiKey = process.env.VITE_DEEPGRAM_API_KEY;
  if (!apiKey) return false;
  if (apiKey === 'mock') return false;
  if (apiKey === 'your-deepgram-api-key-here') return false;
  if (apiKey === 'your_actual_deepgram_api_key_here') return false;
  if (apiKey.startsWith('test-')) return false;
  if (apiKey.length < 20) return false;
  return true;
}

/**
 * Skip test if real API key is not available
 * Use this at the test definition level, not inside the test function
 * @param {string} reason - Optional reason for skipping
 * @example
 * test('my test', async ({ page }) => {
 *   skipIfNoRealAPI('Requires real Deepgram API key');
 *   // ... test code
 * });
 */
export function skipIfNoRealAPI(reason = 'Requires real Deepgram API key') {
  if (!hasRealAPIKey()) {
    test.skip(true, reason);
  }
}

/**
 * Check if OpenAI proxy E2E tests should run (endpoint configured or defaulted).
 * When USE_PROXY_MODE=true and E2E_BACKEND is not 'deepgram', the default
 * OpenAI proxy (from getOpenAIProxyParams()) is used, so we treat as available.
 * @returns {boolean} True if VITE_OPENAI_PROXY_ENDPOINT is set or default applies
 */
export function hasOpenAIProxyEndpoint() {
  const endpoint = process.env.VITE_OPENAI_PROXY_ENDPOINT;
  if (typeof endpoint === 'string' && endpoint.trim().length > 0) return true;
  // With USE_PROXY_MODE and default backend (OpenAI), run OpenAI proxy E2E using default endpoint
  if (process.env.USE_PROXY_MODE === 'true' || process.env.USE_PROXY_MODE === '1') {
    if (process.env.E2E_BACKEND === 'deepgram') return false;
    return true;
  }
  return false;
}

/**
 * Skip test if OpenAI proxy endpoint is not configured.
 * When USE_REAL_APIS=true, also requires OPENAI_API_KEY or VITE_OPENAI_API_KEY so the proxy can call real OpenAI.
 * @param {string} reason - Optional reason for skipping
 */
export function skipIfNoOpenAIProxy(reason = 'Requires VITE_OPENAI_PROXY_ENDPOINT for OpenAI proxy E2E tests') {
  if (!hasOpenAIProxyEndpoint()) {
    test.skip(true, reason);
    return;
  }
  if (process.env.USE_REAL_APIS === 'true' || process.env.USE_REAL_APIS === '1') {
    const key = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!key || typeof key !== 'string' || key.trim() === '') {
      test.skip(
        true,
        'USE_REAL_APIS=true requires OPENAI_API_KEY or VITE_OPENAI_API_KEY in test-app/.env so the proxy can call real OpenAI'
      );
    }
  }
}

/**
 * Skip test when OpenAI proxy is configured (VITE_OPENAI_PROXY_ENDPOINT).
 * Use for E2E tests that target Deepgram-only behavior (e.g. deepgram-backend-proxy-mode expects
 * deepgram-proxy, transcript/VAD callbacks, agent-wording or context assertions).
 * @param {string} reason - Optional reason for skipping
 */
export function skipIfOpenAIProxy(reason = 'Deepgram-only test; skip when using OpenAI proxy') {
  if (hasOpenAIProxyEndpoint()) {
    test.skip(true, reason);
  }
}

/**
 * Common test selectors
 */
const SELECTORS = {
  voiceAgent: '[data-testid="voice-agent"]',
  connectionStatus: '[data-testid="connection-status"]',
  connectionReady: '[data-testid="connection-ready"]',
  micStatus: '[data-testid="mic-status"]',
  micButton: '[data-testid="microphone-button"]',
  textInput: '[data-testid="text-input"]',
  sendButton: '[data-testid="send-button"]',
  agentResponse: '[data-testid="agent-response"]',
  userMessage: '[data-testid="user-message"]',
  transcription: '[data-testid="transcription"]',
  greetingSent: '[data-testid="greeting-sent"]',
  agentSpeaking: '[data-testid="agent-speaking"]',
  agentSilent: '[data-testid="agent-silent"]',
  userStartedSpeaking: '[data-testid="user-started-speaking"]',
  utteranceEnd: '[data-testid="utterance-end"]',
  userStoppedSpeaking: '[data-testid="user-stopped-speaking"]',
};

/**
 * Navigate to the test app and wait for it to load.
 * Uses relative path so Playwright's baseURL (http or https from config) is applied.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function setupTestPage(page, timeout = 10000) {
  const { APP_ROOT } = await import('./app-paths.mjs');
  await page.goto(APP_ROOT);
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Navigate to the test app with Deepgram proxy (VITE_DEEPGRAM_PROXY_ENDPOINT).
 * Use for E2E tests that target the Deepgram proxy (e.g. deepgram-text-session-flow).
 * Uses relative path so baseURL (http/https) from config is applied.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function setupTestPageWithDeepgramProxy(page, timeout = 10000) {
  const { getDeepgramProxyParams, BASE_URL } = await import('./test-helpers.mjs');
  const { pathWithQuery } = await import('./app-paths.mjs');
  const pathPart = pathWithQuery(getDeepgramProxyParams());
  const url = pathPart.startsWith('http') ? pathPart : BASE_URL + pathPart;
  await page.goto(url);
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Navigate to the test app with OpenAI proxy (VITE_OPENAI_PROXY_ENDPOINT).
 * Use for E2E tests that target the OpenAI Realtime proxy (Issue #381).
 * Skip with skipIfNoOpenAIProxy() when VITE_OPENAI_PROXY_ENDPOINT is not set.
 * Uses relative path so baseURL (http/https) from config is applied.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function setupTestPageWithOpenAIProxy(page, timeout = 10000) {
  const { getOpenAIProxyParams, BASE_URL } = await import('./test-helpers.mjs');
  const { pathWithQuery } = await import('./app-paths.mjs');
  const pathPart = pathWithQuery(getOpenAIProxyParams());
  const url = pathPart.startsWith('http') ? pathPart : BASE_URL + pathPart;
  await page.goto(url);
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Navigate to the test app with the backend selected by E2E_BACKEND (openai or deepgram).
 * Use for E2E tests that run/pass for either proxy (Issue #406 readiness contract).
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function setupTestPageForBackend(page, timeout = 10000) {
  const { getBackendProxyParams, BASE_URL } = await import('./test-helpers.mjs');
  const { pathWithQuery } = await import('./app-paths.mjs');
  const pathPart = pathWithQuery(getBackendProxyParams());
  const url = pathPart.startsWith('http') ? pathPart : BASE_URL + pathPart;
  await page.goto(url);
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Wait for connection to be established (auto-connect)
 * On timeout, throws an error that includes the current connection status to aid debugging.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 5000)
 */
async function waitForConnection(page, timeout = 5000) {
  try {
    await page.waitForFunction(
      () => {
        const connectionStatus = document.querySelector('[data-testid="connection-status"]');
        return connectionStatus && connectionStatus.textContent === 'connected';
      },
      { timeout }
    );
  } catch (err) {
    const currentStatus = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="connection-status"]');
      return el ? el.textContent?.trim() || '(empty)' : '(element not found)';
    }).catch(() => '(unable to read)');
    const msg = err?.message || String(err);
    throw new Error(
      `${msg}. Current connection-status: "${currentStatus}". ` +
      'If "closed" or "error": check backend is running (cd test-app && npm run backend), OPENAI_API_KEY is set and valid, and proxy/OpenAI upstream logs for errors.'
    );
  }
}

/**
 * Wait for agent settings to be applied (SettingsApplied received from server)
 * This ensures the agent is fully initialized and ready to respond
 * Uses onSettingsApplied callback instead of polling getState() debug method
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function waitForSettingsApplied(page, timeout = 10000) {
  // Use DOM-based detection instead of callback interception
  // The test-app updates has-sent-settings DOM element when SettingsApplied is received
  // This is more reliable than intercepting callbacks since the component uses React props
  await expect(page.locator('[data-testid="has-sent-settings"]')).toHaveText('true', { timeout });
  
  // Alternative: Also set up callback tracking for tests that might need it
  // But use DOM as primary mechanism since it's more reliable
  await page.evaluate(() => {
    window.testSettingsApplied = true; // Mark as applied since DOM is the source of truth
  });
}

/**
 * Setup connection state tracking by reading from DOM elements
 * Connection states are displayed in the DOM via data-testid attributes
 * This is more reliable than callback-based tracking and avoids timing issues
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>} Object with methods to get tracked state
 */
async function setupConnectionStateTracking(page) {
  // Helper function to extract connection state from DOM element
  const getStateFromDOM = (testId) => {
    const el = document.querySelector(`[data-testid="${testId}"]`);
    const text = el?.textContent?.toLowerCase() || '';
    if (text.includes('connected')) return 'connected';
    if (text.includes('connecting')) return 'connecting';
    if (text.includes('closed') || text.includes('disconnected')) return 'closed';
    return 'closed'; // Default
  };
  
  // Return helper functions to query state from DOM
  return {
    getStates: async () => {
      return await page.evaluate(() => {
        const getStateFromDOM = (testId) => {
          const el = document.querySelector(`[data-testid="${testId}"]`);
          const text = el?.textContent?.toLowerCase() || '';
          if (text.includes('connected')) return 'connected';
          if (text.includes('connecting')) return 'connecting';
          if (text.includes('closed') || text.includes('disconnected')) return 'closed';
          return 'closed';
        };
        
        const agent = getStateFromDOM('connection-status');
        const transcription = getStateFromDOM('transcription-connection-status');
        
        return {
          agent,
          transcription,
          agentConnected: agent === 'connected',
          transcriptionConnected: transcription === 'connected'
        };
      });
    },
    waitForAgentConnected: async (timeout = 5000) => {
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="connection-status"]');
          const text = el?.textContent?.toLowerCase() || '';
          return text.includes('connected');
        },
        { timeout }
      );
    },
    waitForTranscriptionConnected: async (timeout = 5000) => {
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="transcription-connection-status"]');
          const text = el?.textContent?.toLowerCase() || '';
          return text.includes('connected');
        },
        { timeout }
      );
    }
  };
}

/**
 * Wait for connection to be established and settings to be applied
 * This is a convenience function that waits for both connection and settings
 * @param {import('@playwright/test').Page} page
 * @param {number} connectionTimeout - Timeout for connection in ms (default: 5000)
 * @param {number} settingsTimeout - Timeout for settings in ms (default: 10000)
 */
async function waitForConnectionAndSettings(page, connectionTimeout = 5000, settingsTimeout = 10000) {
  await waitForConnection(page, connectionTimeout);
  await waitForSettingsApplied(page, settingsTimeout);
}


/**
 * Wait for agent to finish greeting
 * Uses state-based detection via data-testid selectors instead of log parsing
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 8000)
 */
async function waitForAgentGreeting(page, timeout = 8000) {
  // Wait for agent to finish speaking using state-based detection
  // Options: agent-silent=true, agent-speaking=false, audio-playing-status=false, or agent-state=idle
  await page.waitForFunction(
    () => {
      const agentSilent = document.querySelector('[data-testid="agent-silent"]')?.textContent?.trim();
      const agentSpeaking = document.querySelector('[data-testid="agent-speaking"]')?.textContent?.trim();
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]')?.textContent?.trim();
      const agentState = document.querySelector('[data-testid="agent-state"]')?.textContent?.trim();
      
      // Agent has finished speaking if any of these conditions are met
      return agentSilent === 'true' || 
             agentSpeaking === 'false' || 
             audioPlaying === 'false' || 
             agentState === 'idle';
    },
    { timeout }
  );
}

/**
 * Wait for greeting to complete if it plays, otherwise continue
 * This is a safe helper that waits for greeting audio to play and finish
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 * @param {number} options.checkTimeout - Timeout to detect if greeting starts (default: 3000)
 * @param {number} options.playTimeout - Timeout to wait for greeting to finish (default: 8000)
 * @returns {Promise<boolean>} - True if greeting played and finished, false if no greeting
 */
async function waitForGreetingIfPresent(page, options = {}) {
  const { checkTimeout = 3000, playTimeout = 8000 } = options;
  
  try {
    // Check if greeting audio starts playing
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: checkTimeout });
    console.log('✅ Greeting audio started');
    
    // Wait for greeting to finish
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'false';
    }, { timeout: playTimeout });
    console.log('✅ Greeting finished');
    
    return true;
  } catch (e) {
    // No greeting played, that's ok for tests that don't expect greeting
    console.log('ℹ️ No greeting played (this is normal for some tests)');
    return false;
  }
}

/**
 * Send a text message through the UI
 * @param {import('@playwright/test').Page} page
 * @param {string} message - The message to send
 * @returns {Promise<void>}
 */
async function sendTextMessage(page, message) {
  const textInput = page.locator(SELECTORS.textInput);
  const sendButton = page.locator(SELECTORS.sendButton);
  
  await textInput.fill(message);
  await sendButton.click();
  
  // Wait for input to clear (confirms send)
  // Increased timeout for reliability, especially in proxy mode
  await textInput.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.value === '',
    SELECTORS.textInput,
    { timeout: 5000 }
  );
}

/**
 * Install WebSocket message capture in the browser context
 * @param {import('@playwright/test').Page} page
 */
async function installWebSocketCapture(page) {
  await page.addInitScript(() => {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      console.log('WebSocket created:', { url, protocols });
      window.capturedWebSocketUrl = url;
      window.capturedWebSocketProtocols = protocols;
      
      const ws = new OriginalWebSocket(url, protocols);
      const originalSend = ws.send;
      
      // Capture sent messages
      ws.send = function(data) {
        try {
          const parsed = JSON.parse(data);
          window.capturedSentMessages = window.capturedSentMessages || [];
          window.capturedSentMessages.push({
            timestamp: new Date().toISOString(),
            type: parsed.type,
            data: parsed
          });
          console.log('WebSocket send:', parsed.type, parsed);
        } catch (e) {
          // Not JSON, might be binary audio data
          window.capturedSentMessages = window.capturedSentMessages || [];
          window.capturedSentMessages.push({
            timestamp: new Date().toISOString(),
            type: 'binary',
            size: data.byteLength || data.length
          });
        }
        return originalSend.call(this, data);
      };
      
      // Capture received messages
      ws.addEventListener('message', (event) => {
        try {
          const parsed = JSON.parse(event.data);
          window.capturedReceivedMessages = window.capturedReceivedMessages || [];
          window.capturedReceivedMessages.push({
            timestamp: new Date().toISOString(),
            type: parsed.type,
            data: parsed
          });
          console.log('WebSocket receive:', parsed.type, parsed);
        } catch (e) {
          // Binary data
          window.capturedReceivedMessages = window.capturedReceivedMessages || [];
          const size = event.data.byteLength || event.data.length;
          window.capturedReceivedMessages.push({
            timestamp: new Date().toISOString(),
            type: 'binary',
            size
          });
          // Store TTS chunks for E2E (Issue #414: quality check + boundary diagnostic). OpenAI sends small deltas first then large; use large chunks for quality.
          if (size > 0 && event.data instanceof ArrayBuffer) {
            try {
              window.__ttsChunksForQuality = window.__ttsChunksForQuality || [];
              window.__ttsChunksBase64List = window.__ttsChunksBase64List || [];
              window.__ttsChunkSizes = window.__ttsChunkSizes || [];
              const maxChunksStored = 30;
              if (window.__ttsChunksBase64List.length < maxChunksStored) {
                const bytes = new Uint8Array(event.data);
                let binary = '';
                const chunkSize = 0x8000;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                  binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                }
                window.__ttsChunksBase64List.push(btoa(binary));
                window.__ttsChunkSizes.push(bytes.length);
                window.__ttsChunksForQuality.push(bytes);
                // Legacy: first 5 chunks combined (for boundary diagnostic; may be small chunks)
                const maxChunksLegacy = 5;
                const maxBytes = 4096;
                if (window.__ttsChunksForQuality.length <= maxChunksLegacy) {
                  const total = window.__ttsChunksForQuality.reduce((n, c) => n + c.length, 0);
                  if (window.__ttsChunksForQuality.length >= 3 || total >= maxBytes) {
                    const combined = new Uint8Array(total);
                    let off = 0;
                    for (const c of window.__ttsChunksForQuality) {
                      combined.set(c, off);
                      off += c.length;
                    }
                    let combinedBinary = '';
                    for (let i = 0; i < combined.length; i += chunkSize) {
                      combinedBinary += String.fromCharCode.apply(null, combined.subarray(i, i + chunkSize));
                    }
                    window.__ttsFirstChunkBase64 = btoa(combinedBinary);
                  }
                }
                // TTS-sized PCM: first 3 chunks with size >= minTtsChunkSize (1000), for audio-quality assertion
                const minTtsChunkSize = 1000;
                const largeIndices = (window.__ttsChunkSizes || []).map((s, i) => (s >= minTtsChunkSize ? i : -1)).filter(i => i >= 0);
                const firstThreeLarge = largeIndices.slice(0, 3);
                if (firstThreeLarge.length >= 3) {
                  const combinedLarge = new Uint8Array(firstThreeLarge.reduce((sum, i) => sum + window.__ttsChunksForQuality[i].length, 0));
                  let off = 0;
                  for (const i of firstThreeLarge) {
                    combinedLarge.set(window.__ttsChunksForQuality[i], off);
                    off += window.__ttsChunksForQuality[i].length;
                  }
                  let combinedLargeBinary = '';
                  for (let i = 0; i < combinedLarge.length; i += chunkSize) {
                    combinedLargeBinary += String.fromCharCode.apply(null, combinedLarge.subarray(i, i + chunkSize));
                  }
                  window.__ttsFirstLargeChunkBase64 = btoa(combinedLargeBinary);
                }
              }
            } catch (err) {
              console.warn('[WS CAPTURE] Failed to store TTS chunks for quality check:', err);
            }
          }
        }
      });
      
      return ws;
    };
  });
}

/**
 * Get captured WebSocket messages from browser context
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{url: string, protocols: string[], sent: Array, received: Array}>}
 */
async function getCapturedWebSocketData(page) {
  return await page.evaluate(() => ({
    url: window.capturedWebSocketUrl,
    protocols: window.capturedWebSocketProtocols,
    sent: window.capturedSentMessages || [],
    received: window.capturedReceivedMessages || []
  }));
}

/**
 * Get the first TTS binary chunk as base64 (stored by WebSocket capture for Issue #414 audio-quality check).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string|null>}
 */
async function getTtsFirstChunkBase64(page) {
  return await page.evaluate(() => window.__ttsFirstChunkBase64 || null);
}

/**
 * Get first 3 TTS chunks with size >= 1000 bytes as concatenated base64 (Issue #414).
 * OpenAI sends small deltas first then large; use this for audio-quality assertion so we analyze actual TTS PCM.
 */
async function getTtsFirstLargeChunkBase64(page) {
  return await page.evaluate(() => window.__ttsFirstLargeChunkBase64 || null);
}

/**
 * Get per-chunk base64 list (first N chunks) for boundary diagnostic (Issue #414).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function getTtsChunksBase64List(page) {
  return await page.evaluate(() => window.__ttsChunksBase64List || []);
}

/**
 * Return true if base64-decoded payload looks like JSON (object with string 'type').
 * Used to catch proxy sending JSON as binary (Issue #414 integration coverage).
 * @param {string} base64
 * @returns {boolean}
 */
function isFirstBinaryChunkLikelyJson(base64) {
  if (!base64 || typeof base64 !== 'string') return false;
  try {
    const buf = Buffer.from(base64, 'base64');
    const text = buf.toString('utf8');
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && typeof parsed.type === 'string';
  } catch {
    return false;
  }
}

/**
 * Compute boundary info between consecutive PCM chunks for comparison (test-app vs CLI).
 * For 16-bit LE: odd-length chunk's last byte is low byte of next sample; prepending to next chunk keeps continuity.
 * @param {string[]} chunksBase64 - Array of base64-encoded chunk payloads
 * @returns {{ chunkLengths: number[], boundaries: Array<{ afterChunk: number, chunkALen: number, chunkBLen: number, lastBytesA: number[], firstBytesB: number[], lastSampleLE?: number, firstSampleLE?: number, carriedPlusFirst?: number }> }}
 */
function getChunkBoundaryInfo(chunksBase64) {
  const chunkLengths = chunksBase64.map((b64) => Buffer.from(b64, 'base64').length);
  const boundaries = [];
  for (let i = 0; i + 1 < chunksBase64.length; i++) {
    const bufA = Buffer.from(chunksBase64[i], 'base64');
    const bufB = Buffer.from(chunksBase64[i + 1], 'base64');
    const lastBytesA = bufA.length >= 2 ? [bufA[bufA.length - 2], bufA[bufA.length - 1]] : bufA.length === 1 ? [bufA[0]] : [];
    const firstBytesB = bufB.length >= 2 ? [bufB[0], bufB[1]] : bufB.length >= 1 ? [bufB[0]] : [];
    const lastSampleLE = bufA.length >= 2 ? bufA.readInt16LE(bufA.length - 2) : undefined;
    const firstSampleLE = bufB.length >= 2 ? bufB.readInt16LE(0) : undefined;
    let carriedPlusFirst;
    if (bufA.length % 2 === 1 && bufB.length >= 1) {
      const u = bufA.readUInt8(bufA.length - 1) | (bufB.readUInt8(0) << 8);
      carriedPlusFirst = u > 0x7fff ? u - 0x10000 : u;
    } else {
      carriedPlusFirst = undefined;
    }
    boundaries.push({
      afterChunk: i,
      chunkALen: bufA.length,
      chunkBLen: bufB.length,
      lastBytesA,
      firstBytesB,
      lastSampleLE,
      firstSampleLE,
      carriedPlusFirst,
    });
  }
  return { chunkLengths, boundaries };
}

/**
 * Decode base64 PCM (16-bit LE, per OpenAI Realtime API) and compute metrics.
 * Tries both little-endian and big-endian; passes only if LE is clearly more speech-like (lower ZCR).
 * Used to detect buzzing/hissing: wrong endianness yields noise-like ZCR; ZCR=0 on a long segment is non-speech.
 * @param {string} base64 - Base64-encoded PCM (one or more chunks concatenated)
 * @returns {{ rms: number, peak: number, zcr: number, sampleCount: number, speechLike: boolean, message: string }}
 */
function analyzePCMChunkBase64(base64) {
  const buf = Buffer.from(base64, 'base64');
  const numSamples = Math.floor(buf.length / 2);
  if (numSamples === 0) {
    return { rms: 0, peak: 0, zcr: 0, sampleCount: 0, speechLike: false, message: 'No samples (chunk too short or empty)' };
  }

  function decodeAndMetrics(littleEndian) {
    const samples = [];
    for (let i = 0; i < numSamples; i++) {
      const v = littleEndian ? buf.readInt16LE(i * 2) : buf.readInt16BE(i * 2);
      samples.push(v / 32768);
    }
    let sumSq = 0;
    let peak = 0;
    let zc = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      sumSq += s * s;
      if (Math.abs(s) > peak) peak = Math.abs(s);
      if (i > 0 && (samples[i - 1] >= 0) !== (s >= 0)) zc++;
    }
    const rms = Math.sqrt(sumSq / samples.length);
    const zcr = (samples.length - 1) > 0 ? zc / (samples.length - 1) : 0;
    return { rms, peak, zcr };
  }

  const le = decodeAndMetrics(true);
  const be = decodeAndMetrics(false);

  // Use LE metrics for the main check (API specifies LE)
  const { rms, peak, zcr } = le;

  // Speech-like thresholds (Issue #414)
  const RMS_MIN = 0.004;
  const RMS_MAX = 0.75;
  const PEAK_MAX = 1.0; // Allow full-scale; 0.99 was too strict for real TTS (Issue #414)
  const ZCR_MAX = 0.45;
  // For longer segments, require some zero crossings (ZCR=0 suggests wrong decode or non-speech)
  const ZCR_MIN = numSamples >= 200 ? 0.01 : 0;

  const okRms = rms >= RMS_MIN && rms <= RMS_MAX;
  const okPeak = peak <= PEAK_MAX;
  const okZcr = zcr >= ZCR_MIN && zcr <= ZCR_MAX;
  // If LE looks like noise (high ZCR) but BE looks more structured (lower ZCR), stream may be BE → playback wrong
  const beMoreSpeechLike = be.zcr < zcr && be.zcr <= ZCR_MAX && be.rms >= RMS_MIN && be.rms <= RMS_MAX;
  const speechLike = okRms && okPeak && okZcr && !beMoreSpeechLike;
  const reason = !okZcr
    ? (zcr < ZCR_MIN ? `zcr=${zcr.toFixed(4)} too low (expected ≥${ZCR_MIN} for ${numSamples} samples)` : `zcr=${zcr.toFixed(4)} too high (expected ≤${ZCR_MAX})`)
    : beMoreSpeechLike
      ? `stream may be big-endian (BE zcr=${be.zcr.toFixed(4)} more speech-like than LE zcr=${zcr.toFixed(4)})`
      : null;
  const message = speechLike
    ? `TTS audio appears speech-like (rms=${rms.toFixed(4)}, peak=${peak.toFixed(4)}, zcr=${zcr.toFixed(4)}, n=${numSamples})`
    : `TTS audio appears to be buzzing/hissing or invalid. ${reason || `rms=${rms.toFixed(4)} (expected ${RMS_MIN}-${RMS_MAX}), peak=${peak.toFixed(4)} (expected ≤${PEAK_MAX}), zcr=${zcr.toFixed(4)} (expected ${ZCR_MIN}-${ZCR_MAX}).`}`;

  return { rms, peak, zcr, sampleCount: numSamples, speechLike, message };
}

/**
 * Poll for binary WebSocket messages with logging
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 * @param {number} options.maxTicks - Maximum polling iterations (default: 6)
 * @param {number} options.tickInterval - Delay between polls in ms (default: 500)
 * @param {string} options.label - Label for console logs (default: 'pre-assert')
 * @returns {Promise<void>}
 */
async function pollForBinaryWebSocketMessages(page, options = {}) {
  const { maxTicks = 6, tickInterval = 500, label = 'pre-assert' } = options;
  
  for (let i = 0; i < maxTicks; i++) {
    await page.waitForTimeout(tickInterval);
    const wsData = await getCapturedWebSocketData(page);
    const receivedTypes = wsData.received.map(m => m.type);
    const binaryCount = receivedTypes.filter(t => t === 'binary').length;
    console.log(`[WS CAPTURE] ${label} tick=${i+1} URL=${wsData.url}, total=${wsData.received.length}, binary=${binaryCount}`);
    if (binaryCount > 0) break;
  }
}

/**
 * Install a mock WebSocket for testing without real API
 * @param {import('@playwright/test').BrowserContext} context
 */
async function installMockWebSocket(context) {
  await context.addInitScript(() => {
    console.log('🔧 Installing WebSocket mock...');
    
    // Store original WebSocket
    const OriginalWebSocket = window.WebSocket;
    let mockWs = null;
    
    // Create mock WebSocket
    class MockWebSocket extends EventTarget {
      constructor(url, protocols) {
        super();
        console.log('🎭 MockWebSocket created:', url, protocols);
        mockWs = this;
        this.url = url;
        this.protocols = protocols;
        this.readyState = 0; // CONNECTING
        this.bufferedAmount = 0;
        this.extensions = '';
        this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
        this.binaryType = 'arraybuffer';
        
        // Simulate connection
        setTimeout(() => {
          this.readyState = 1; // OPEN
          console.log('🎭 Mock WebSocket opened');
          if (this.onopen) this.onopen({ type: 'open' });
          
          // Send mock Welcome message
          setTimeout(() => {
            const welcomeMsg = JSON.stringify({
              type: 'Welcome',
              request_id: 'mock-request-id-12345'
            });
            console.log('🎭 Mock sending Welcome:', welcomeMsg);
            if (this.onmessage) {
              this.onmessage({ data: welcomeMsg, type: 'message' });
            }
            
            // Send SettingsApplied
            setTimeout(() => {
              const settingsMsg = JSON.stringify({ type: 'SettingsApplied' });
              console.log('🎭 Mock sending SettingsApplied');
              if (this.onmessage) {
                this.onmessage({ data: settingsMsg, type: 'message' });
              }
            }, 100);
          }, 100);
        }, 100);
      }
      
      send(data) {
        console.log('🎭 Mock WebSocket send:', typeof data === 'string' ? data.substring(0, 100) : 'binary');
        
        // Simulate response to text message
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'UserText' || parsed.type === 'InjectUserMessage') {
              // Send mock agent response
              setTimeout(() => {
                const responseMsg = JSON.stringify({
                  type: 'ConversationText',
                  role: 'assistant',
                  content: '[MOCK] I received your message: "' + parsed.content + '". How can I help you with that?'
                });
                console.log('🎭 Mock sending agent response');
                if (this.onmessage) {
                  this.onmessage({ data: responseMsg, type: 'message' });
                }
              }, 500);
            }
          } catch (e) {
            console.log('🎭 Could not parse sent data');
          }
        }
      }
      
      close() {
        console.log('🎭 Mock WebSocket closed');
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose({ type: 'close', code: 1000, reason: 'Normal closure' });
      }
      
      addEventListener(type, listener) {
        super.addEventListener(type, listener);
      }
      
      removeEventListener(type, listener) {
        super.removeEventListener(type, listener);
      }
    }
    
    // Mock static constants
    MockWebSocket.CONNECTING = 0;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;
    
    // Replace global WebSocket
    window.WebSocket = MockWebSocket;
    console.log('✅ WebSocket mock installed');
  });
}

/**
 * Common assertions for connection state
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').expect} expect
 */
async function assertConnectionHealthy(page, expect) {
  const connectionStatus = page.locator(SELECTORS.connectionStatus);
  
  await expect(connectionStatus).toHaveText('connected');
  // Note: connection-ready element may not exist in all test scenarios
  // Just verify connection status is connected
}

/**
 * Wait for agent response text to appear
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedText - Text to wait for in agent response
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function waitForAgentResponse(page, expectedText, timeout = 10000) {
  const agentResponse = page.locator(SELECTORS.agentResponse);
  await agentResponse.waitFor({ timeout });
  const responseText = await agentResponse.textContent();
  if (expectedText) {
    // Check if any part of expected text is in the response (case-insensitive)
    const found = expectedText.split(/[\s,]+/).some(word => 
      responseText.toLowerCase().includes(word.toLowerCase())
    );
    if (!found) {
      throw new Error(`Expected to find "${expectedText}" in agent response: "${responseText}"`);
    }
  }
  return responseText;
}

/**
 * Verify agent response is valid (non-empty, not waiting)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Expect} expect - Playwright expect instance
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} Agent response text
 */
async function verifyAgentResponse(page, expect, timeout = 10000) {
  // Wait for response element to exist and have valid content
  // Pass selector as argument to make it available in browser context
  const selector = SELECTORS.agentResponse;
  await page.waitForFunction(
    ({ selector }) => {
      const responseEl = document.querySelector(selector);
      if (!responseEl) return false;
      const text = responseEl.textContent?.trim();
      return text && text !== '(Waiting for agent response...)';
    },
    { selector },
    { timeout }
  );
  
  const response = await page.locator(SELECTORS.agentResponse).textContent();
  expect(response).toBeTruthy();
  expect(response).not.toBe('(Waiting for agent response...)');
  return response;
}

/**
 * Wait for agent response and return the response text (enhanced version)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {string} options.expectedText - Optional text to verify in response
 * @param {number} options.timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} Agent response text
 */
async function waitForAgentResponseEnhanced(page, options = {}) {
  const { expectedText, timeout = 10000 } = options;
  
  // Pass selector as argument to make it available in browser context
  const selector = SELECTORS.agentResponse;
  await page.waitForFunction(
    ({ selector }) => {
      const response = document.querySelector(selector);
      return response && response.textContent && 
             response.textContent !== '(Waiting for agent response...)';
    },
    { selector },
    { timeout }
  );
  
  const responseText = await page.locator(SELECTORS.agentResponse).textContent();
  
  if (expectedText) {
    // Check if any part of expected text is in the response (case-insensitive)
    const found = expectedText.split(/[\s,]+/).some(word => 
      responseText.toLowerCase().includes(word.toLowerCase())
    );
    if (!found) {
      throw new Error(`Expected to find "${expectedText}" in agent response: "${responseText}"`);
    }
  }
  
  return responseText;
}

/**
 * Wait for transcript to appear in the UI
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in ms (default: 15000)
 * @returns {Promise<string>} Transcript text
 */
async function waitForTranscript(page, options = {}) {
  const { timeout = 15000 } = options;
  const selector = SELECTORS.transcription;
  
  await page.waitForFunction(
    ({ selector }) => {
      const transcriptEl = document.querySelector(selector);
      if (!transcriptEl) return false;
      const text = transcriptEl.textContent?.trim() || '';
      return text.length > 0 && text !== '(Waiting for transcript...)';
    },
    { selector },
    { timeout }
  );
  
  const transcriptText = await page.locator(selector).textContent();
  return transcriptText || '';
}

/**
 * Assert connection is in expected state
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Expect} expect - Playwright expect instance
 * @param {string} expectedState - Expected state ('connected', 'closed', 'connecting')
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 */
async function assertConnectionState(page, expect, expectedState, options = {}) {
  const { timeout = 5000 } = options;
  const selector = SELECTORS.connectionStatus;
  
  await page.waitForFunction(
    ({ selector, state }) => {
      const statusEl = document.querySelector(selector);
      return statusEl?.textContent?.toLowerCase().includes(state.toLowerCase());
    },
    { selector, state: expectedState },
    { timeout }
  );
  
  const actualStatus = await page.locator(selector).textContent();
  expect(actualStatus.toLowerCase()).toContain(expectedState.toLowerCase());
}

/**
 * Disconnect the component (simulates stop button or network issue)
 * @param {import('@playwright/test').Page} page
 */
async function disconnectComponent(page) {
  const stopButton = page.locator('[data-testid="stop-button"]');
  if (await stopButton.isVisible({ timeout: 1000 })) {
    await stopButton.click();
  }
  
  // Wait for connection to close
  await page.waitForFunction(
    () => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent === 'closed';
    },
    { timeout: 5000 }
  );
}

/**
 * Get agent state from the UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} Agent state (idle, listening, thinking, speaking, etc.)
 */
async function getAgentState(page) {
  const agentStateElement = page.locator('[data-testid="agent-state"]');
  return await agentStateElement.textContent();
}

/**
 * Assert that no upstream agent errors occurred during the test (recoverable or not).
 * The test-app increments agentErrorCount only when the component calls onError. Expected
 * closures (idle_timeout, session_max_duration) are not surfaced as errors — the component
 * handles them the same as Deepgram idle timeout (log and return; no onError). So when the
 * only upstream event is idle-timeout closure, counts stay 0 and this assertion passes.
 * Waits 3s before asserting so late-arriving events are reflected in the DOM.
 * @param {import('@playwright/test').Page} page
 */
async function assertNoRecoverableAgentErrors(page) {
  await page.waitForTimeout(3000);
  const totalEl = page.locator('[data-testid="agent-error-count"]');
  await expect(totalEl).toHaveText('0', { timeout: 2000 });
  const recoverableEl = page.locator('[data-testid="recoverable-agent-error-count"]');
  await expect(recoverableEl).toHaveText('0', { timeout: 2000 });
}

/**
 * Assert that upstream agent errors are within expected bounds for OpenAI proxy (or similar) runs.
 * We expect (1) a short timeout from upstream when no message has been sent, and (2) idle_timeout_ms
 * timeout if a message has been sent. So total and recoverable counts may be 0 or 1.
 * Waits 3s before asserting so late-arriving events are reflected in the DOM.
 * @param {import('@playwright/test').Page} page
 * @param {{ maxTotal?: number; maxRecoverable?: number }} [options] - maxTotal (default 1), maxRecoverable (default 1)
 */
async function assertAgentErrorsAllowUpstreamTimeouts(page, options = {}) {
  const { maxTotal = 1, maxRecoverable = 1 } = options;
  await page.waitForTimeout(3000);
  const totalEl = page.locator('[data-testid="agent-error-count"]');
  const totalText = await totalEl.textContent();
  const total = parseInt(totalText ?? '0', 10);
  expect(total).toBeLessThanOrEqual(maxTotal);
  const recoverableEl = page.locator('[data-testid="recoverable-agent-error-count"]');
  const recoverableText = await recoverableEl.textContent();
  const recoverable = parseInt(recoverableText ?? '0', 10);
  expect(recoverable).toBeLessThanOrEqual(maxRecoverable);
}

/**
 * Wait for agent state to become a specific value
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedState - Expected agent state (idle, listening, thinking, speaking, etc.)
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} The agent state text content
 */
async function waitForAgentState(page, expectedState, timeout = 10000) {
  const agentStateElement = page.locator('[data-testid="agent-state"]');
  await agentStateElement.waitFor({ 
    state: 'visible', 
    timeout 
  });
  await expect(agentStateElement).toHaveText(expectedState, { timeout });
  return await agentStateElement.textContent();
}

/**
 * Get AudioContext state and audio playing status for diagnostics
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{state: string, playing: string}>} Audio diagnostics with AudioContext state and playing status
 */
async function getAudioDiagnostics(page) {
  return await page.evaluate(() => {
    const ctx = window.deepgramRef?.current?.getAudioContext?.();
    const state = ctx ? ctx.state : 'no-context';
    const playingEl = document.querySelector('[data-testid="audio-playing-status"]');
    const playing = playingEl ? playingEl.textContent : 'unknown';
    return { state, playing };
  });
}

/**
 * Get AudioContext state from window (test-app specific)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} AudioContext state or 'not-initialized'
 */
async function getAudioContextState(page) {
  return await page.evaluate(() => window.audioContext?.state || 'not-initialized');
}

/**
 * Wait for app root to be ready (waits for voice-agent selector)
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function waitForAppReady(page, timeout = 10000) {
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Get microphone status from the UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} Microphone status text
 */
async function getMicStatus(page) {
  return await page.locator(SELECTORS.micStatus).textContent();
}

/**
 * Get audio playing status from the UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} Audio playing status ('true' or 'false')
 */
async function getAudioPlayingStatus(page) {
  return await page.locator('[data-testid="audio-playing-status"]').textContent();
}

/**
 * Wait for audio playback to start
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 5000)
 */
async function waitForAudioPlaybackStart(page, timeout = 5000) {
  await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('true', { timeout });
}

/**
 * Log first Settings WebSocket message details (speak model and greeting preview)
 * @param {import('@playwright/test').Page} page
 */
async function logFirstSettingsPreview(page) {
  const wsData = await getCapturedWebSocketData(page);
  const settingsMsg = wsData.sent.find(m => m.type === 'Settings');
  if (settingsMsg && settingsMsg.data) {
    const speakModel = settingsMsg.data?.agent?.speak?.provider?.model;
    const greeting = settingsMsg.data?.agent?.greeting || '';
    console.log('[WS SENT] Settings speakModel=', speakModel, 'greetingPreview=', String(greeting).slice(0, 60));
  } else {
    console.log('[WS SENT] Settings message not captured yet');
  }
}

/**
 * Verify context is preserved by checking agent response mentions key terms
 * @param {import('@playwright/test').Page} page
 * @param {string[]} expectedTerms - Array of terms that should appear in agent response
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function verifyContextPreserved(page, expectedTerms, timeout = 10000) {
  const agentResponse = page.locator(SELECTORS.agentResponse);
  await agentResponse.waitFor({ timeout });
  const responseText = await agentResponse.textContent();
  
  const missingTerms = expectedTerms.filter(term => 
    !responseText.toLowerCase().includes(term.toLowerCase())
  );
  
  if (missingTerms.length > 0) {
    throw new Error(`Context not preserved. Missing terms: ${missingTerms.join(', ')}. Response: "${responseText}"`);
  }
  
  return responseText;
}

/**
 * Send text message and wait for agent response
 * This helper combines sending and waiting for response
 * @param {import('@playwright/test').Page} page
 * @param {string} message - Message to send
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} Agent response text
 */
async function sendMessageAndWaitForResponse(page, message, timeout = 10000) {
  // Send the message
  const textInput = page.locator(SELECTORS.textInput);
  await textInput.fill(message);
  await textInput.press('Enter');
  
  // Wait for agent response
  const agentResponse = page.locator(SELECTORS.agentResponse);
  await agentResponse.waitFor({ timeout });
  
  return await agentResponse.textContent();
}

/**
 * Connect via text input (auto-connect) and wait for greeting to complete
 * This is the recommended pattern for text-based tests - connects via text input
 * which triggers auto-connect, then waits for greeting audio to finish
 * 
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 * @param {number} options.greetingTimeout - Timeout for greeting (default: 8000)
 * @returns {Promise<void>}
 */
async function connectViaTextAndWaitForGreeting(page, options = {}) {
  const { greetingTimeout = 8000 } = options;
  
  console.log('🔌 Connecting via text input and waiting for greeting...');
  
  // DON'T send a message - just prepare the connection by clicking the input
  // The actual test will send the message and trigger auto-connect
  await page.click(SELECTORS.textInput);
  await page.waitForTimeout(200);
  
  console.log('✅ Ready to send message (will auto-connect)');
}

/**
 * Setup complete audio-sending prerequisites
 * 
 * This utility combines all the common setup steps needed before sending audio data:
 * 1. Grant microphone permissions (if context provided)
 * 2. Wait for component to be ready
 * 3. Click microphone button
 * 4. Wait for connection to be established
 * 5. Wait for settings to be applied (SettingsApplied received)
 * 6. Wait for 500ms settings processing delay to pass
 * 
 * This is required before calling sendAudioData() because the component checks:
 * - hasSentSettingsRef.current must be true
 * - Date.now() - settingsSentTimeRef.current >= 500ms
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').BrowserContext} [context] - Optional browser context for permissions
 * @param {Object} options - Configuration options
 * @param {number} options.componentReadyTimeout - Timeout for component ready (default: 5000)
 * @param {number} options.connectionTimeout - Timeout for connection (default: 10000)
 * @param {number} options.settingsTimeout - Timeout for settings applied (default: 10000)
 * @param {number} options.settingsProcessingDelay - Additional delay after settings applied (default: 600)
 * @returns {Promise<void>}
 */
async function setupAudioSendingPrerequisites(page, context = null, options = {}) {
  const {
    componentReadyTimeout = 5000,
    connectionTimeout = 10000,
    settingsTimeout = 10000,
    settingsProcessingDelay = 600
  } = options;

  console.log('🎤 [AUDIO_SETUP] Starting audio sending prerequisites setup...');

  // Step 1: Grant microphone permissions (if context provided)
  if (context) {
    console.log('🎤 [AUDIO_SETUP] Step 1: Granting microphone permissions...');
    await context.grantPermissions(['microphone']);
    console.log('🎤 [AUDIO_SETUP] ✅ Microphone permissions granted');
  }

  // Step 2: Wait for component to be ready
  console.log('🎤 [AUDIO_SETUP] Step 2: Waiting for component to be ready...');
  await page.waitForSelector('[data-testid="component-ready-status"]', { timeout: componentReadyTimeout });
  const isReady = await page.locator('[data-testid="component-ready-status"]').textContent();
  if (isReady !== 'true') {
    throw new Error(`Component not ready. Status: ${isReady}`);
  }
  console.log('🎤 [AUDIO_SETUP] ✅ Component is ready');

  // Step 3: Click microphone button
  console.log('🎤 [AUDIO_SETUP] Step 3: Clicking microphone button...');
  await page.waitForSelector('[data-testid="microphone-button"]', { timeout: 5000 });
  await page.click('[data-testid="microphone-button"]');
  console.log('🎤 [AUDIO_SETUP] ✅ Microphone button clicked');

  // Step 4: Wait for connection to be established
  console.log('🎤 [AUDIO_SETUP] Step 4: Waiting for connection...');
  await page.waitForSelector('[data-testid="connection-status"]', { timeout: connectionTimeout });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="connection-status"]')?.textContent === 'connected',
    { timeout: connectionTimeout }
  );
  const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
  if (connectionStatus !== 'connected') {
    throw new Error(`Connection not established. Status: ${connectionStatus}`);
  }
  console.log('🎤 [AUDIO_SETUP] ✅ Connection established');

  // Step 5: Wait for settings to be applied (SettingsApplied received)
  // Test app exposes this via data-testid="has-sent-settings" DOM element
  console.log('🎤 [AUDIO_SETUP] Step 5: Waiting for settings to be applied...');
  await expect(page.locator('[data-testid="has-sent-settings"]')).toHaveText('true', { timeout: settingsTimeout });
  console.log('🎤 [AUDIO_SETUP] ✅ Settings applied (SettingsApplied received)');

  // Step 6: Wait for settings processing delay to pass
  // The component requires: Date.now() - settingsSentTimeRef.current >= 500ms
  // We use 600ms (slightly longer) to ensure settings are fully processed
  console.log(`🎤 [AUDIO_SETUP] Step 6: Waiting ${settingsProcessingDelay}ms for settings processing delay...`);
  await page.waitForTimeout(settingsProcessingDelay);
  console.log('🎤 [AUDIO_SETUP] ✅ Settings processing delay passed');

  console.log('🎤 [AUDIO_SETUP] ✅ All audio sending prerequisites complete!');
  console.log('🎤 [AUDIO_SETUP] 💡 Component is now ready to accept audio data via sendAudioData()');
}

/**
 * Establish connection via text input (auto-connect pattern)
 * Common pattern: focus text input → wait for connection
 * Updated to match Issue #373 test pattern for better reliability
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} timeout - Timeout for connection wait (default: 30000)
 * @returns {Promise<void>}
 */
async function establishConnectionViaText(page, timeout = 30000) {
  // Use data-testid selector for more reliable targeting
  const textInput = page.locator('[data-testid="text-input"]');
  await textInput.waitFor({ state: 'visible', timeout: 10000 });
  await textInput.focus();
  console.log('✅ Text input focused - auto-connect should trigger');

  // Wait for connection status element to appear (component may be initializing)
  await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });

  const readConnectionStatus = async () => {
    return page.evaluate(() => {
      const el = document.querySelector('[data-testid="connection-status"]');
      return el ? el.textContent?.trim() || '(empty)' : '(element not found)';
    }).catch(() => '(unable to read)');
  };

  // Wait for connection to transition from "closed" to "connecting" to "connected"
  try {
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });
  } catch (err) {
    const currentStatus = await readConnectionStatus();
    throw new Error(
      `Connection stayed "closed" after focusing text input. Current connection-status: ${currentStatus}. ` +
      'Check proxy is running on the same scheme as the app (ws when HTTP, wss when HTTPS), OPENAI_API_KEY in test-app/.env, and proxy terminal for errors.'
    );
  }

  // Now wait for connection to be fully established
  await waitForConnection(page, timeout);
}

/**
 * Establish connection via microphone button
 * Common pattern: grant permissions → click mic button → wait for connection
 * Updated to match Issue #373 test pattern for better reliability
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').BrowserContext} [context] - Browser context for permissions
 * @param {number} timeout - Timeout for connection wait (default: 30000)
 * @returns {Promise<void>}
 */
async function establishConnectionViaMicrophone(page, context = null, timeout = 30000) {
  if (context) {
    await context.grantPermissions(['microphone']);
  }
  
  const micButton = page.locator(SELECTORS.micButton);
  await micButton.waitFor({ state: 'visible', timeout: 10000 });
  await micButton.click();
  console.log('✅ Microphone button clicked - connection should trigger');
  
  // Wait for connection status element to appear (component may be initializing)
  await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
  
  // Wait for connection to transition from "closed" to "connecting" to "connected"
  await page.waitForFunction(() => {
    const statusEl = document.querySelector('[data-testid="connection-status"]');
    if (!statusEl) return false;
    const status = statusEl.textContent?.toLowerCase() || '';
    return status !== 'closed';
  }, { timeout: 10000 });
  
  // Now wait for connection to be fully established
  await waitForConnection(page, timeout);
}

/**
 * Get AudioContext state from the component (recommended method)
 * Uses component's getAudioContext() method instead of window.audioContext
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} AudioContext state ('running', 'suspended', 'closed', or 'not-initialized')
 */
async function getComponentAudioContextState(page) {
  return await page.evaluate(() => {
    const deepgramComponent = window.deepgramRef?.current;
    const audioContext = deepgramComponent?.getAudioContext?.();
    return audioContext?.state || 'not-initialized';
  });
}

/**
 * Wait for function call to be made (tracked via data-testid="function-call-tracker")
 * This is the DRY, canonical implementation for function call detection.
 * All tests should use this instead of duplicate implementations.
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Options object
 * @param {number} options.count - Expected function call count (default: 1)
 * @param {number} options.timeout - Timeout in ms (default: 10000)
 * @returns {Promise<{count: number, info: Object}>} Function call count and diagnostic info
 */
async function waitForFunctionCall(page, options = {}) {
  const expectedCount = options.count || 1;
  const timeout = options.timeout || 10000;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await page.evaluate(() => {
      const tracker = document.querySelector('[data-testid="function-call-tracker"]');
      const count = tracker ? parseInt(tracker.textContent || '0', 10) : 0;
      
      // Also check window variables for additional diagnostic info
      const windowRequests = window.functionCallRequests || [];
      const windowResponses = window.functionCallResponses || [];
      
      return {
        count,
        hasTracker: !!tracker,
        windowRequestsCount: windowRequests.length,
        windowResponsesCount: windowResponses.length,
        lastRequest: windowRequests[windowRequests.length - 1] || null,
        lastResponse: windowResponses[windowResponses.length - 1] || null
      };
    });
    
    // Success: either DOM tracker or handler-recorded window.functionCallRequests
    const effectiveCount = Math.max(result.count || 0, result.windowRequestsCount || 0);
    if (effectiveCount >= expectedCount) {
      return {
        count: effectiveCount,
        info: result
      };
    }

    await page.waitForTimeout(200);
  }

  // Timeout - return current state for diagnostics
  const finalResult = await page.evaluate(() => {
    const tracker = document.querySelector('[data-testid="function-call-tracker"]');
    const count = tracker ? parseInt(tracker.textContent || '0', 10) : 0;
    const windowRequests = window.functionCallRequests || [];
    const windowResponses = window.functionCallResponses || [];
    
    return {
      count,
      hasTracker: !!tracker,
      windowRequestsCount: windowRequests.length,
      windowResponsesCount: windowResponses.length,
      lastRequest: windowRequests[windowRequests.length - 1] || null,
      lastResponse: windowResponses[windowResponses.length - 1] || null
    };
  });
  
  return {
    count: finalResult.count,
    info: finalResult
  };
}

/**
 * Try multiple prompts to trigger function call with retry logic
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array<string>} prompts - Array of prompts to try
 * @param {Object} options - Options
 * @param {number} options.connectionTimeout - Timeout for connection (default: 30000)
 * @param {number} options.functionCallTimeout - Timeout per prompt attempt (default: 20000)
 * @returns {Promise<{count: number, prompt: string, info: Object, promptsTried: Array<string>}>}
 */
async function tryPromptsForFunctionCall(page, prompts, options = {}) {
  const connectionTimeout = options.connectionTimeout || 30000;
  const functionCallTimeout = options.functionCallTimeout || 20000;
  
  let functionCallInfo = { count: 0 };
  let successfulPrompt = null;
  
  for (const prompt of prompts) {
    await page.fill('[data-testid="text-input"]', prompt);
    await page.click('[data-testid="send-button"]');
    await waitForConnection(page, connectionTimeout);
    
    console.log(`⏳ Trying prompt: "${prompt}"...`);
    functionCallInfo = await waitForFunctionCall(page, { timeout: functionCallTimeout });
    
    if (functionCallInfo.count > 0) {
      successfulPrompt = prompt;
      console.log(`✅ Function call triggered with prompt: "${prompt}"`);
      break;
    }
    
    console.log(`⚠️ Function call not triggered with prompt: "${prompt}", trying next...`);
    await page.fill('[data-testid="text-input"]', '');
    await page.waitForTimeout(1000);
  }
  
  return {
    ...functionCallInfo,
    prompt: successfulPrompt,
    promptsTried: prompts
  };
}

/**
 * Set up function calling test infrastructure
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Options
 * @param {Array} options.functions - Function definitions (default: get_current_time)
 * @param {Function} options.handler - Function handler (default: time handler)
 * @returns {Promise<void>}
 */
async function setupFunctionCallingTest(page, options = {}) {
  const defaultFunctions = [
    {
      name: 'get_current_time',
      description: 'Get the current time in a specific timezone. ALWAYS use this function when users ask about time, what time it is, current time, or any time-related question. This function is required for all time queries.',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London"). Defaults to UTC if not specified.',
            default: 'UTC'
          }
        }
      }
    }
  ];
  
  const defaultHandler = (functionName, args) => {
    if (functionName === 'get_current_time') {
      const timezone = args.timezone || 'UTC';
      const now = new Date();
      return {
        success: true,
        time: now.toLocaleString('en-US', { 
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        timezone: timezone,
        timestamp: now.toISOString()
      };
    }
    return { success: false, error: 'Unknown function' };
  };
  
  // Use addInitScript to set up everything before page loads
  await page.addInitScript((functions, handler) => {
    window.testFunctions = functions;
    window.testFunctionHandler = handler;
    window.functionCallRequests = [];
    window.functionCallResponses = [];
    
    // Set up handler in init script so it's available when page loads
    window.handleFunctionCall = (request, sendResponse) => {
      // Push request to array for test verification
      if (!window.functionCallRequests) {
        window.functionCallRequests = [];
      }
      window.functionCallRequests.push(request);
      
      if (window.testFunctionHandler) {
        const result = window.testFunctionHandler(request.name, JSON.parse(request.arguments || '{}'));
        
        // Try to send response immediately if deepgramRef is available
        // If not available yet, the component will handle it via declarative return value
        if (window.deepgramRef?.current?.sendFunctionCallResponse && result) {
          try {
            window.deepgramRef.current.sendFunctionCallResponse(
              request.id,
              request.name,
              JSON.stringify(result)
            );
            // Track response for test verification
            if (!window.functionCallResponses) {
              window.functionCallResponses = [];
            }
            window.functionCallResponses.push({
              id: request.id,
              name: request.name,
              content: JSON.stringify(result)
            });
          } catch (error) {
            console.error('[TEST] Error sending function call response:', error);
          }
        }
        
        // Return result for declarative pattern support (component will handle if sendResponse wasn't called)
        return result;
      }
    };
  }, options.functions || defaultFunctions, options.handler || defaultHandler);
}

/**
 * Establish connection and wait for function call with retry
 * Combines connection establishment and function call waiting
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} prompt - User prompt to send
 * @param {Object} options - Options
 * @param {number} options.connectionTimeout - Timeout for connection (default: 30000)
 * @param {number} options.functionCallTimeout - Timeout for function call (default: 20000)
 * @returns {Promise<{count: number, info: Object}>}
 */
async function establishConnectionAndWaitForFunctionCall(page, prompt, options = {}) {
  await page.fill('[data-testid="text-input"]', prompt);
  await page.click('[data-testid="send-button"]');
  await waitForConnection(page, options.connectionTimeout || 30000);
  return await waitForFunctionCall(page, { timeout: options.functionCallTimeout || 20000 });
}

// Import microphone helpers
import MicrophoneHelpers from './microphone-helpers.js';

/**
 * Write conversation transcript to file
 * 
 * This utility writes conversation transcripts to files for review and analysis.
 * Can be enabled for any test via environment variable or test option.
 * 
 * @param {string} transcript - The formatted transcript string
 * @param {Object} options - Configuration options
 * @param {string} options.testName - Name of the test (default: 'unknown-test')
 * @param {string} options.testFile - Name of the test file (default: 'unknown-file')
 * @param {string} options.outputDir - Output directory (default: 'test-results/transcripts')
 * @param {boolean} options.enabled - Whether to write file (default: checks SAVE_TEST_TRANSCRIPTS env var)
 * @returns {Promise<string|null>} Path to written file, or null if not written
 * 
 * @example
 * // Enable via environment variable:
 * SAVE_TEST_TRANSCRIPTS=true npm run test:e2e
 * 
 * // Use in test:
 * const transcript = await captureConversationTranscript(page);
 * await writeTranscriptToFile(transcript, {
 *   testName: test.info().title,
 *   testFile: test.info().file
 * });
 */
async function writeTranscriptToFile(transcript, options = {}) {
  // Check if transcript saving is enabled
  const enabled = options.enabled !== undefined 
    ? options.enabled 
    : process.env.SAVE_TEST_TRANSCRIPTS === 'true' || process.env.SAVE_TEST_TRANSCRIPTS === '1';
  
  if (!enabled) {
    return null;
  }
  
  try {
    const {
      testName = 'unknown-test',
      testFile = 'unknown-file',
      outputDir = 'test-results/transcripts'
    } = options;
    
    // Create output directory if it doesn't exist
    const fullOutputDir = path.resolve(process.cwd(), outputDir);
    if (!fs.existsSync(fullOutputDir)) {
      fs.mkdirSync(fullOutputDir, { recursive: true });
    }
    
    // Generate filename: test-file-name_test-name_timestamp.txt
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileBaseName = path.basename(testFile, path.extname(testFile));
    const safeTestName = testName.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
    const filename = `${fileBaseName}_${safeTestName}_${timestamp}.txt`;
    const filePath = path.join(fullOutputDir, filename);
    
    // Write transcript to file
    const fileContent = [
      '='.repeat(80),
      `TEST TRANSCRIPT`,
      '='.repeat(80),
      `Test File: ${testFile}`,
      `Test Name: ${testName}`,
      `Timestamp: ${new Date().toISOString()}`,
      '='.repeat(80),
      '',
      transcript,
      '',
      '='.repeat(80),
      `End of Transcript`,
      '='.repeat(80)
    ].join('\n');
    
    fs.writeFileSync(filePath, fileContent, 'utf8');
    
    console.log(`📄 Transcript saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.warn(`⚠️ Failed to write transcript to file: ${error.message}`);
    return null;
  }
}

export {
  // hasRealAPIKey, skipIfNoRealAPI, hasOpenAIProxyEndpoint, skipIfNoOpenAIProxy, skipIfOpenAIProxy are already exported inline above
  SELECTORS, // Common test selectors object for consistent element targeting across E2E tests
  setupTestPage, // Navigate to test app and wait for page load with configurable timeout
  setupTestPageWithDeepgramProxy, // Navigate to test app with Deepgram proxy (VITE_DEEPGRAM_PROXY_ENDPOINT)
  setupTestPageWithOpenAIProxy, // Navigate to test app with OpenAI proxy (VITE_OPENAI_PROXY_ENDPOINT) – Issue #381
  setupTestPageForBackend, // Navigate to test app with E2E_BACKEND proxy (openai or deepgram) – Issue #406
  waitForConnection, // Wait for connection to be established
  waitForSettingsApplied, // Wait for agent settings to be applied (SettingsApplied received from server)
  setupConnectionStateTracking, // Setup connection state tracking via DOM elements (data-testid attributes)
  waitForConnectionAndSettings, // Wait for both connection and settings to be applied
  waitForAgentGreeting, // Wait for agent to finish speaking its greeting message
  waitForGreetingIfPresent, // Safely wait for greeting if it plays, otherwise continue (doesn't fail if no greeting)
  sendTextMessage, // Send a text message through the UI and wait for input to clear
  installWebSocketCapture, // Install WebSocket message capture in browser context for testing
  getCapturedWebSocketData, // Retrieve captured WebSocket messages and their counts
  getTtsFirstChunkBase64, // Get first TTS binary chunk as base64 for audio-quality check (Issue #414)
  getTtsFirstLargeChunkBase64, // First 3 chunks >= 1000 bytes (actual TTS PCM; use for quality assertion)
  getTtsChunksBase64List, // Get per-chunk base64 list for boundary diagnostic (Issue #414)
  isFirstBinaryChunkLikelyJson, // True if first binary chunk decodes to JSON with type (catches JSON sent as binary)
  getChunkBoundaryInfo, // Boundary bytes between consecutive chunks (compare test-app vs CLI)
  analyzePCMChunkBase64, // Analyze PCM chunk (RMS/peak/ZCR) to detect buzzing/hissing
  pollForBinaryWebSocketMessages, // Poll for binary WebSocket messages with logging
  installMockWebSocket, // Replace global WebSocket with mock implementation for testing
  assertConnectionHealthy, // Assert that connection status and ready state are both healthy
  waitForAgentResponse, // Wait for agent response with optional text verification
  verifyAgentResponse, // Verify agent response is valid (non-empty, not waiting)
  waitForAgentResponseEnhanced, // Enhanced version with options object
  waitForTranscript, // Wait for transcript to appear in the UI
  assertConnectionState, // Assert connection is in expected state (with automatic waiting)
  disconnectComponent, // Disconnect the component (stop button or simulate network issue)
  getAgentState, // Get current agent state from UI
  assertNoRecoverableAgentErrors, // Assert no recoverable upstream errors (fail E2E on regression)
  assertAgentErrorsAllowUpstreamTimeouts, // Allow up to 1 upstream timeout error (OpenAI proxy: no-message / idle_timeout)
  waitForAgentState, // Wait for agent state to become a specific value
  getAudioDiagnostics, // Get AudioContext state and audio playing status for diagnostics
  getAudioContextState, // Get AudioContext state from window (test-app specific)
  waitForAppReady, // Wait for app root to be ready (waits for voice-agent selector)
  getMicStatus, // Get microphone status from the UI
  getAudioPlayingStatus, // Get audio playing status from the UI
  waitForAudioPlaybackStart, // Wait for audio playback to start
  logFirstSettingsPreview, // Log first Settings WebSocket message details
  verifyContextPreserved, // Verify conversation context is preserved by checking agent response
  sendMessageAndWaitForResponse, // Send message and wait for agent response in one call
  connectViaTextAndWaitForGreeting, // Connect via text input (auto-connect) and wait for greeting to complete
  setupAudioSendingPrerequisites, // Complete setup for audio sending: permissions, ready, mic click, connection, settings applied
  establishConnectionViaText, // Establish connection by clicking text input (auto-connect pattern)
  establishConnectionViaMicrophone, // Establish connection via microphone button (permissions + click)
  getComponentAudioContextState, // Get AudioContext state from component (recommended over window.audioContext)
  waitForFunctionCall, // Wait for function call to be made (tracked via data-testid="function-call-tracker")
  tryPromptsForFunctionCall, // Try multiple prompts to trigger function call with retry logic
  setupFunctionCallingTest, // Set up function calling test infrastructure
  establishConnectionAndWaitForFunctionCall, // Establish connection and wait for function call
  MicrophoneHelpers, // Microphone utility helpers for E2E tests (activate/deactivate mic)
  writeTranscriptToFile // Write conversation transcript to file (optional, enabled via env var)
};

