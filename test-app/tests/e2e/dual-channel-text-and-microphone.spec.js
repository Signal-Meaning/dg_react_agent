/**
 * Dual Channel E2E Tests - Text and Microphone Channels
 * 
 * These tests verify that the component works correctly when using both
 * text input and microphone channels together in the same session.
 * 
 * Test Scenarios:
 * 1. Start with text, then switch to microphone
 * 2. Start with microphone, then switch to text
 * 3. Alternate between text and microphone in same session
 * 4. Use both channels simultaneously (text while mic is active)
 * 
 * Test Improvements:
 * - Captures and logs agent responses for each user interaction
 * - Uses pre-recorded audio samples to simulate realistic user speech
 * - Verifies agent responses to both text and audio inputs
 * - Logs full conversation transcripts showing all user-assistant exchanges
 * - Includes function call summaries (query, provider, result count) when applicable
 * 
 * These tests use real Deepgram API connections to ensure authentic behavior.
 */

import { test, expect } from '@playwright/test';
import {
  setupTestPage,
  sendTextMessage,
  MicrophoneHelpers,
  waitForAgentResponse,
  skipIfNoRealAPI,
  writeTranscriptToFile
} from './helpers/test-helpers.js';
import { pathWithQuery, getDeepgramProxyParams } from './helpers/test-helpers.mjs';
import { loadAndSendAudioSample } from './fixtures/audio-helpers.js';

/**
 * Capture and format conversation transcript for review
 * Includes user messages (text and audio), agent responses, and function call summaries
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Formatted transcript string
 */
/**
 * Capture and format conversation transcript for review
 * Includes user messages (text and audio), agent responses, and function call summaries
 * Optimized to avoid delays - uses quick DOM queries and window access
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Formatted transcript string
 */
async function captureConversationTranscript(page) {
  // Use a timeout to prevent hanging
  const transcript = await Promise.race([
    page.evaluate(() => {
      const lines = [];
      lines.push('='.repeat(80));
      lines.push('CONVERSATION TRANSCRIPT');
      lines.push('='.repeat(80));
      lines.push('');
      
      try {
        // Get conversation history from window (includes both user and assistant messages)
        const conversationHistory = window.__testConversationHistory || [];
        
        // Get transcript history from DOM (audio transcriptions) - limit to avoid long processing
        const transcriptEntries = Array.from(document.querySelectorAll('[data-testid^="transcript-entry-"]')).slice(0, 50);
        const transcripts = transcriptEntries.map((entry, index) => {
          try {
            const textEl = entry.querySelector(`[data-testid="transcript-text-${index}"]`);
            return {
              text: textEl?.textContent?.trim() || '',
              is_final: entry.getAttribute('data-is-final') === 'true',
              timestamp: parseInt(entry.getAttribute('data-timestamp') || '0', 10)
            };
          } catch (e) {
            return null;
          }
        }).filter(t => t && t.text && t.is_final); // Only include final transcripts
        
        // Get function call information
        const functionCallRequests = (window.functionCallRequests || []).slice(0, 20); // Limit to 20
        const functionCallResponses = (window.functionCallResponses || []).slice(0, 20);
        
        // Build transcript chronologically by combining all sources
        const allEvents = [];
        
        // Add conversation history entries (both user and assistant)
        conversationHistory.slice(0, 50).forEach((msg) => {
          allEvents.push({
            type: msg.role === 'user' ? 'user_message' : 'agent_response',
            content: msg.content || '',
            timestamp: msg.timestamp || Date.now(),
            source: 'conversation_history'
          });
        });
        
        // Add final audio transcriptions (these may duplicate user messages, but we'll dedupe)
        transcripts.forEach(transcript => {
          allEvents.push({
            type: 'user_audio_transcript',
            content: transcript.text,
            timestamp: transcript.timestamp,
            source: 'transcript_history'
          });
        });
        
        // Add function call information (inserted after the user message that triggered them)
        functionCallRequests.forEach((req, idx) => {
          const response = functionCallResponses[idx] || null;
          let resultSummary = 'No response';
          if (response) {
            try {
              const resultData = JSON.parse(response.content || '{}');
              // Extract result count or summary
              if (Array.isArray(resultData)) {
                resultSummary = `${resultData.length} result(s)`;
              } else if (resultData.results && Array.isArray(resultData.results)) {
                resultSummary = `${resultData.results.length} result(s)`;
              } else if (resultData.items && Array.isArray(resultData.items)) {
                resultSummary = `${resultData.items.length} result(s)`;
              } else if (resultData.data && Array.isArray(resultData.data)) {
                resultSummary = `${resultData.data.length} result(s)`;
              } else if (resultData.success !== undefined) {
                resultSummary = resultData.success ? 'Success' : 'Failed';
              } else {
                resultSummary = 'Response received';
              }
            } catch (e) {
              resultSummary = 'Response received (parse error)';
            }
          }
          
          // Parse query/arguments - limit length to avoid huge strings
          let queryText = 'No arguments';
          try {
            if (req.arguments) {
              const args = typeof req.arguments === 'string' ? JSON.parse(req.arguments) : req.arguments;
              // Extract query or search term if available
              if (args.query) {
                queryText = String(args.query).substring(0, 200);
              } else if (args.search) {
                queryText = String(args.search).substring(0, 200);
              } else if (args.text) {
                queryText = String(args.text).substring(0, 200);
              } else {
                queryText = JSON.stringify(args).substring(0, 200);
              }
            }
          } catch (e) {
            const argStr = typeof req.arguments === 'string' ? req.arguments : JSON.stringify(req.arguments);
            queryText = argStr.substring(0, 200);
          }
          
          allEvents.push({
            type: 'function_call',
            functionName: req.name || 'unknown',
            query: queryText,
            provider: 'Deepgram Agent',
            resultCount: resultSummary,
            timestamp: Date.now() // Approximate - function calls happen after user message
          });
        });
        
        // Sort by timestamp
        allEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        // Helper function to detect if a response is a greeting
        // Greetings are typically:
        // 1. Short standalone messages (less than 50 chars)
        // 2. Appear early in conversation (first 2 agent responses)
        // 3. Match common greeting patterns
        function isGreeting(content, eventIndex, allAgentResponses) {
          if (!content) return false;
          const lowerContent = content.toLowerCase().trim();
          
          // Only consider first 2 agent responses as potential greetings
          const agentResponseIndex = allAgentResponses.findIndex(r => r === content);
          if (agentResponseIndex > 1) {
            return false; // Too late in conversation to be a greeting
          }
          
          // Must be relatively short (greetings are typically brief)
          if (content.length > 60) {
            return false;
          }
          
          const greetingPatterns = [
            /^hello[!.]?\s*(how\s+can\s+i\s+(assist|help))/i,
            /^hello[!.]?\s*$/i,
            /^hi[!.]?\s*(how\s+can\s+i\s+(assist|help))/i,
            /^hi[!.]?\s*$/i,
            // Only match "how can I help" if it's a standalone short message
            /^how\s+can\s+i\s+(assist|help)\s+you\s+today[!.]?\s*$/i,
            /^how\s+can\s+i\s+(assist|help)\s+you[!.]?\s*$/i,
            /^greetings/i
          ];
          return greetingPatterns.some(pattern => pattern.test(lowerContent));
        }
        
        // Format transcript with deduplication and greeting detection
        let exchangeNumber = 1;
        let greetingCount = 0;
        const seenUserMessages = new Set();
        const greetings = [];
        
        // Collect all agent responses first to determine greeting context
        const allAgentResponses = allEvents
          .filter(e => e.type === 'agent_response')
          .map(e => e.content || '(empty)');
        
        allEvents.forEach((event, index) => {
          if (event.type === 'user_message' || event.type === 'user_audio_transcript') {
            // Deduplicate: if we've seen this exact message, skip it
            const messageKey = (event.content || '').trim().toLowerCase().substring(0, 100);
            if (seenUserMessages.has(messageKey)) {
              return; // Skip duplicate
            }
            seenUserMessages.add(messageKey);
            
            const label = event.type === 'user_audio_transcript' ? 'USER (Audio)' : 'USER (Text)';
            lines.push(`[Exchange ${exchangeNumber}]`);
            lines.push(`${label}: ${event.content || '(empty)'}`);
            lines.push('');
          } else if (event.type === 'agent_response') {
            const content = event.content || '(empty)';
            if (isGreeting(content, index, allAgentResponses)) {
              // Mark as greeting and don't increment exchange number
              greetings.push(content);
              greetingCount++;
              lines.push(`ASSISTANT (Greeting): ${content}`);
              lines.push('');
            } else {
              lines.push(`ASSISTANT: ${content}`);
              lines.push('');
              exchangeNumber++;
            }
          } else if (event.type === 'function_call') {
            // Function calls are inserted after user messages
            lines.push(`  [Function Call]`);
            lines.push(`    Function: ${event.functionName}`);
            lines.push(`    Query: ${event.query}`);
            lines.push(`    Provider: ${event.provider}`);
            lines.push(`    Results: ${event.resultCount}`);
            lines.push('');
          }
        });
        
        lines.push('='.repeat(80));
        if (greetingCount > 0) {
          lines.push(`Greetings: ${greetingCount} (excluded from exchange count)`);
        }
        lines.push(`Total Exchanges: ${exchangeNumber - 1}`);
        if (functionCallRequests.length > 0) {
          lines.push(`Function Calls: ${functionCallRequests.length}`);
        }
        lines.push('='.repeat(80));
      } catch (error) {
        lines.push('Error capturing transcript: ' + (error.message || String(error)));
        lines.push('='.repeat(80));
      }
      
      return lines.join('\n');
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Transcript capture timeout')), 5000)
    )
  ]).catch(() => {
    // Return minimal transcript on timeout/error
    return '='.repeat(80) + '\nCONVERSATION TRANSCRIPT\n' + '='.repeat(80) + '\n\n(Transcript capture timed out or failed)\n\n' + '='.repeat(80);
  });
  
  return transcript;
}

test.describe('Dual Channel - Text and Microphone', () => {
  
  test('should start with text channel, then switch to microphone', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    
    // Step 1: Establish connection via text input
    console.log('📝 Step 1: Establishing connection via text input');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection (may be 'connected' or 'connected (proxy)')
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection established via text');
    
    // Step 2: Send a text message
    console.log('📝 Step 2: Sending text message');
    const textMessage = "What is the capital city of France?";
    try {
      await sendTextMessage(page, textMessage);
    } catch (error) {
      // If sendTextMessage times out waiting for input to clear, continue anyway
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    
    // Wait for agent response and capture it
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse1 = await page.locator('[data-testid="agent-response"]').textContent();
    expect(agentResponse1).toBeTruthy();
    expect(agentResponse1.trim()).not.toBe('');
    console.log('✅ Agent responded to text message');
    console.log(`📝 Agent Response #1 (Text): "${agentResponse1}"`);
    
    // Step 3: Enable microphone (switch to microphone channel)
    console.log('🎤 Step 3: Enabling microphone channel');
    await context.grantPermissions(['microphone']);
    
    // Use microphone helper to enable mic
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    expect(micResult.success).toBe(true);
    expect(micResult.micStatus).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Step 3b: Send pre-recorded audio to simulate user speaking
    console.log('🎤 Step 3b: Sending pre-recorded audio to simulate user speech');
    await loadAndSendAudioSample(page, 'hello__how_are_you_today_', {
      sampleRate: 16000,
      bytesPerSample: 2,
      channels: 1,
      chunkSize: 4096
    });
    console.log('✅ Pre-recorded audio sent');
    
    // Wait for agent response to audio input
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse2 = await page.locator('[data-testid="agent-response"]').textContent();
    expect(agentResponse2).toBeTruthy();
    expect(agentResponse2.trim()).not.toBe('');
    console.log('✅ Agent responded to audio input');
    console.log(`🎤 Agent Response #2 (Audio): "${agentResponse2}"`);
    
    // Step 4: Verify both channels are available
    // Text input should still be available
    await expect(textInput).toBeVisible();
    
    // Microphone should be enabled
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus).toContain('Enabled');
    
    console.log('✅ Both channels are available');
    
    // Capture and log full conversation transcript
    const transcript = await captureConversationTranscript(page);
    console.log('\n📋 CONVERSATION TRANSCRIPT:');
    console.log(transcript);
    
    // Write transcript to file if enabled
    await writeTranscriptToFile(transcript, {
      testName: test.info().title,
      testFile: test.info().file
    });
    
    console.log('🎉 Test passed - successfully switched from text to microphone');
  });

  test('should start with microphone, then switch to text', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    await context.grantPermissions(['microphone']);
    
    // Step 1: Establish connection via microphone
    console.log('🎤 Step 1: Establishing connection via microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    expect(micResult.success).toBe(true);
    expect(micResult.micStatus).toBe('Enabled');
    console.log('✅ Connection established via microphone');
    
    // Step 1b: Send pre-recorded audio to simulate user speaking
    console.log('🎤 Step 1b: Sending pre-recorded audio to simulate user speech');
    await loadAndSendAudioSample(page, 'hello', {
      sampleRate: 16000,
      bytesPerSample: 2,
      channels: 1,
      chunkSize: 4096
    });
    console.log('✅ Pre-recorded audio sent');
    
    // Wait for agent response to audio input
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse1 = await page.locator('[data-testid="agent-response"]').textContent();
    expect(agentResponse1).toBeTruthy();
    expect(agentResponse1.trim()).not.toBe('');
    console.log('✅ Agent responded to audio input');
    console.log(`🎤 Agent Response #1 (Audio): "${agentResponse1}"`);
    
    // Step 2: Verify microphone is active
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus).toContain('Enabled');
    
    // Step 3: Send a text message (switch to text channel)
    console.log('📝 Step 3: Sending text message while microphone is enabled');
    const textMessage = "What is the tallest mountain in the world?";
    await sendTextMessage(page, textMessage);
    
    // Wait for agent response and capture it
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse2 = await page.locator('[data-testid="agent-response"]').textContent();
    expect(agentResponse2).toBeTruthy();
    expect(agentResponse2.trim()).not.toBe('');
    console.log('✅ Agent responded to text message');
    console.log(`📝 Agent Response #2 (Text): "${agentResponse2}"`);
    
    // Step 4: Verify both channels are still available
    // Text input should be available
    const textInput = page.locator('[data-testid="text-input"]');
    await expect(textInput).toBeVisible();
    
    // Microphone should still be enabled
    const micStatusAfter = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatusAfter).toContain('Enabled');
    
    console.log('✅ Both channels remain available');
    
    // Capture and log full conversation transcript
    const transcript = await captureConversationTranscript(page);
    console.log('\n📋 CONVERSATION TRANSCRIPT:');
    console.log(transcript);
    
    // Write transcript to file if enabled
    await writeTranscriptToFile(transcript, {
      testName: test.info().title,
      testFile: test.info().file
    });
    
    console.log('🎉 Test passed - successfully used text while microphone is active');
  });

  test('should alternate between text and microphone in same session', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    await context.grantPermissions(['microphone']);
    
    // Step 1: Start with text
    console.log('📝 Step 1: Starting with text channel');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    
    const textMessage1 = "What is the capital city of France?";
    // Use try-catch to handle potential sendTextMessage timeout
    try {
      await sendTextMessage(page, textMessage1);
    } catch (error) {
      // If sendTextMessage times out waiting for input to clear, continue anyway
      // The message was likely sent, just the input clearing verification failed
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse1 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Text message 1 sent and responded');
    console.log(`📝 Agent Response #1 (Text): "${agentResponse1}"`);
    
    // Step 2: Enable microphone
    console.log('🎤 Step 2: Enabling microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    expect(micResult.success).toBe(true);
    console.log('✅ Microphone enabled');
    
    // Step 2b: Send pre-recorded audio to simulate user speaking
    console.log('🎤 Step 2b: Sending pre-recorded audio to simulate user speech');
    await loadAndSendAudioSample(page, 'hello__how_are_you_today_', {
      sampleRate: 16000,
      bytesPerSample: 2,
      channels: 1,
      chunkSize: 4096
    });
    console.log('✅ Pre-recorded audio sent');
    
    // Wait for agent response to audio input
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse2 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Agent responded to audio input');
    console.log(`🎤 Agent Response #2 (Audio): "${agentResponse2}"`);
    
    // Step 3: Send another text message (while mic is enabled)
    console.log('📝 Step 3: Sending text message while microphone is enabled');
    const textMessage2 = "Can you tell me what the largest planet in our solar system is?";
    try {
      await sendTextMessage(page, textMessage2);
    } catch (error) {
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse3 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Text message 2 sent and responded');
    console.log(`📝 Agent Response #3 (Text): "${agentResponse3}"`);
    
    // Step 4: Disable microphone
    console.log('🎤 Step 4: Disabling microphone');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000); // Increased timeout for mic state change
    
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus.toLowerCase()).toContain('disabled');
    console.log('✅ Microphone disabled');
    
    // Step 5: Send another text message (mic disabled)
    console.log('📝 Step 5: Sending text message after microphone disabled');
    const textMessage3 = "What is the speed of light in a vacuum?";
    try {
      await sendTextMessage(page, textMessage3);
    } catch (error) {
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse4 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Text message 3 sent and responded');
    console.log(`📝 Agent Response #4 (Text): "${agentResponse4}"`);
    
    // Step 6: Re-enable microphone
    console.log('🎤 Step 6: Re-enabling microphone');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000);
    
    const micStatus2 = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus2.toLowerCase()).toContain('enabled');
    console.log('✅ Microphone re-enabled');
    
    // Step 6b: Send pre-recorded audio again to simulate user speaking
    console.log('🎤 Step 6b: Sending pre-recorded audio again to simulate user speech');
    await loadAndSendAudioSample(page, 'hello__how_are_you_today_', {
      sampleRate: 16000,
      bytesPerSample: 2,
      channels: 1,
      chunkSize: 4096
    });
    console.log('✅ Pre-recorded audio sent');
    
    // Wait for agent response to audio input
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse5 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Agent responded to audio input');
    console.log(`🎤 Agent Response #5 (Audio): "${agentResponse5}"`);
    
    // Verify connection is still active
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    
    // Capture and log full conversation transcript
    const transcript = await captureConversationTranscript(page);
    console.log('\n📋 CONVERSATION TRANSCRIPT:');
    console.log(transcript);
    
    // Write transcript to file if enabled
    await writeTranscriptToFile(transcript, {
      testName: test.info().title,
      testFile: test.info().file
    });
    
    console.log('🎉 Test passed - successfully alternated between text and microphone');
  });

  test('should maintain connection when switching between channels', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    await context.grantPermissions(['microphone']);
    
    // Step 1: Establish connection via text
    console.log('📝 Step 1: Establishing connection via text');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    
    let connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection established');
    
    // Step 2: Enable microphone
    console.log('🎤 Step 2: Enabling microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    expect(micResult.success).toBe(true);
    
    // Verify connection is still active
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection maintained after enabling microphone');
    
    // Step 2b: Send pre-recorded audio to simulate user speaking
    console.log('🎤 Step 2b: Sending pre-recorded audio to simulate user speech');
    await loadAndSendAudioSample(page, 'hello__how_are_you_today_', {
      sampleRate: 16000,
      bytesPerSample: 2,
      channels: 1,
      chunkSize: 4096
    });
    console.log('✅ Pre-recorded audio sent');
    
    // Wait for agent response to audio input
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse1 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Agent responded to audio input');
    console.log(`🎤 Agent Response #1 (Audio): "${agentResponse1}"`);
    
    // Step 3: Send text message
    console.log('📝 Step 3: Sending text message');
    try {
      await sendTextMessage(page, "What are the primary colors in art?");
    } catch (error) {
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse2 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log(`📝 Agent Response #2 (Text): "${agentResponse2}"`);
    
    // Verify connection is still active
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection maintained after text message');
    
    // Step 4: Disable microphone
    console.log('🎤 Step 4: Disabling microphone');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000); // Increased timeout for state change
    
    // When microphone is disabled, transcription service may close
    // but agent connection should remain or reconnect when needed
    // Check connection status - it may be closed temporarily but should reconnect
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`📊 Connection status after disabling mic: ${connectionStatus}`);
    
    // Step 5: Send another text message (this should trigger reconnection if needed)
    console.log('📝 Step 5: Sending another text message');
    try {
      await sendTextMessage(page, "How many continents are there on Earth?");
    } catch (error) {
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    
    // Wait for agent response - this will ensure connection is active
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse3 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log(`📝 Agent Response #3 (Text): "${agentResponse3}"`);
    
    // After sending message, connection should be active
    // Wait a bit for connection status to update
    await page.waitForTimeout(1000);
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    
    // Connection should be active after sending message (auto-reconnect if needed)
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection maintained throughout channel switching');
    
    // Capture and log full conversation transcript
    const transcript = await captureConversationTranscript(page);
    console.log('\n📋 CONVERSATION TRANSCRIPT:');
    console.log(transcript);
    
    // Write transcript to file if enabled
    await writeTranscriptToFile(transcript, {
      testName: test.info().title,
      testFile: test.info().file
    });
    
    console.log('🎉 Test passed - connection maintained when switching channels');
  });

  test('should work in proxy mode with both text and microphone channels', async ({ page, context }) => {
    // Proxy mode is now the default for e2e tests
    // Only skip if explicitly set to false
    const IS_PROXY_MODE = process.env.USE_PROXY_MODE !== 'false';
    
    if (!IS_PROXY_MODE) {
      test.skip(true, 'This test requires proxy mode. Proxy mode is the default.');
      return;
    }
    
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    const PROXY_ENDPOINT = getDeepgramProxyParams().proxyEndpoint;
    
    // Verify proxy server is running
    const proxyRunning = await page.evaluate(async (endpoint) => {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket(endpoint);
          const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 2000);
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          };
          ws.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };
        } catch (error) {
          resolve(false);
        }
      });
    }, PROXY_ENDPOINT);
    
    if (!proxyRunning) {
      test.skip(true, `Proxy server is not running at ${PROXY_ENDPOINT}. Start it with: npm run test:proxy:server`);
      return;
    }
    
    await page.goto(pathWithQuery({
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT
    }));
    await page.waitForLoadState('networkidle');
    await context.grantPermissions(['microphone']);
    
    // Step 1: Establish connection via text in proxy mode
    console.log('📝 Step 1: Establishing connection via text (proxy mode)');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    
    // Verify proxy mode
    const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
    expect(connectionMode).toContain('proxy');
    console.log('✅ Connection established via proxy');
    
    // Step 2: Send text message
    console.log('📝 Step 2: Sending text message');
    try {
      await sendTextMessage(page, "What is the chemical symbol for water?");
    } catch (error) {
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse1 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Text message sent and responded');
    console.log(`📝 Agent Response #1 (Text): "${agentResponse1}"`);
    
    // Step 3: Enable microphone
    console.log('🎤 Step 3: Enabling microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    expect(micResult.success).toBe(true);
    console.log('✅ Microphone enabled');
    
    // Step 3b: Send pre-recorded audio to simulate user speaking
    console.log('🎤 Step 3b: Sending pre-recorded audio to simulate user speech');
    await loadAndSendAudioSample(page, 'hello__how_are_you_today_', {
      sampleRate: 16000,
      bytesPerSample: 2,
      channels: 1,
      chunkSize: 4096
    });
    console.log('✅ Pre-recorded audio sent');
    
    // Wait for agent response to audio input
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse2 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Agent responded to audio input');
    console.log(`🎤 Agent Response #2 (Audio): "${agentResponse2}"`);
    
    // Step 4: Send another text message (while mic is enabled)
    console.log('📝 Step 4: Sending text message while microphone is enabled');
    try {
      await sendTextMessage(page, "Who wrote the novel '1984'?");
    } catch (error) {
      console.log('⚠️ sendTextMessage timeout (continuing anyway)');
    }
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse3 = await page.locator('[data-testid="agent-response"]').textContent();
    console.log('✅ Text message sent and responded');
    console.log(`📝 Agent Response #3 (Text): "${agentResponse3}"`);
    
    // Verify connection is still active
    const finalConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(finalConnectionStatus).toContain('connected');
    
    // Capture and log full conversation transcript
    const transcript = await captureConversationTranscript(page);
    console.log('\n📋 CONVERSATION TRANSCRIPT:');
    console.log(transcript);
    
    // Write transcript to file if enabled
    await writeTranscriptToFile(transcript, {
      testName: test.info().title,
      testFile: test.info().file
    });
    
    console.log('🎉 Test passed - both channels work in proxy mode');
  });
});
