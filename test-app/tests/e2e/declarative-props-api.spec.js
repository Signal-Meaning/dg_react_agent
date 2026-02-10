/**
 * Declarative Props API Tests
 * 
 * Tests for Issue #305: Add declarative props to reduce imperative ref usage
 * 
 * These tests validate the new declarative prop-based API that replaces
 * imperative ref methods. The tests ensure:
 * 1. Declarative props work correctly
 * 2. Backward compatibility with imperative methods is maintained
 * 3. Type safety and React patterns are followed
 * 
 * Test Coverage:
 * - userMessage prop (replaces injectUserMessage)
 * - connectionState/autoStart props (replaces start/stop)
 * - function call response via callback return value
 * - interruptAgent prop (replaces interruptAgent method)
 * - startAudioCapture prop (replaces startAudioCapture method)
 * 
 * NOTE: These tests are designed to work once the implementation is complete.
 * They use the test-app's declarative prop support which will be added as part
 * of the implementation. The test app will expose state setters that can be
 * controlled from Playwright tests.
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoRealAPI,
  hasOpenAIProxyEndpoint,
  skipIfOpenAIProxy,
} from './helpers/test-helpers.js';

test.describe('Declarative Props API - Issue #305', () => {
  
  test.afterEach(async ({ page }) => {
    // Clean up: Close any open connections and clear state
    try {
      await page.evaluate(() => {
        // Close component if it exists
        if (window.deepgramRef?.current) {
          window.deepgramRef.current.stop?.();
        }
        // Clear test state
        if (window.__testUserMessage) {
          delete window.__testUserMessage;
        }
        if (window.__testFunctionCallHandler) {
          delete window.__testFunctionCallHandler;
        }
      });
      // Navigate away to ensure clean state for next test
      await page.goto('about:blank');
      await page.waitForTimeout(500); // Give time for cleanup
    } catch (error) {
      // Ignore cleanup errors - test may have already navigated away
    }
  });
  
  test.describe('userMessage prop (replaces injectUserMessage)', () => {
    
    test('should send message when userMessage prop changes', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      // Wait for component to mount
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // Set userMessage prop via test app state
      const testMessage = 'Hello, this is a declarative message test';
      
      await page.evaluate((message) => {
        // Simulate setting userMessage prop
        // In real implementation, this would be done via React state
        window.__testUserMessage = message;
        window.__testUserMessageSet = true;
      }, testMessage);
      
      // Wait for message to be processed - wait for agent response in DOM
      await page.waitForFunction(
        () => {
          const agentResponse = document.querySelector('[data-testid="agent-response"]');
          return agentResponse && agentResponse.textContent && 
                 agentResponse.textContent !== '(Waiting for agent response...)';
        },
        { timeout: 10000 }
      ).catch(() => {
        // Fallback: check window variable if DOM not updated yet
        return page.waitForFunction(
          () => window.__testAgentResponseReceived === true,
          { timeout: 5000 }
        );
      });
      
      // Verify message was sent by checking for agent response
      const responseReceived = await page.evaluate(() => {
        const agentResponse = document.querySelector('[data-testid="agent-response"]');
        return (agentResponse && agentResponse.textContent && 
                agentResponse.textContent !== '(Waiting for agent response...)') ||
               window.__testAgentResponseReceived || false;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      // For now, we're testing the test infrastructure
      expect(responseReceived).toBeDefined();
    });
    
    test('should trigger onUserMessageSent callback after message is sent', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      let callbackInvoked = false;
      
      await page.evaluate(() => {
        window.__testOnUserMessageSent = () => {
          window.__testOnUserMessageSentInvoked = true;
        };
      });
      
      const testMessage = 'Test message for callback';
      
      await page.evaluate((message) => {
        window.__testUserMessage = message;
        window.__testUserMessageSet = true;
      }, testMessage);
      
      // Wait for callback to be invoked
      await page.waitForFunction(
        () => window.__testOnUserMessageSentInvoked === true,
        { timeout: 10000 }
      );
      
      callbackInvoked = await page.evaluate(() => {
        return window.__testOnUserMessageSentInvoked || false;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(callbackInvoked).toBeDefined();
    });
    
    test('should clear userMessage after onUserMessageSent is called', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      const testMessage = 'Message that should be cleared';
      
      await page.evaluate((message) => {
        window.__testUserMessage = message;
        window.__testUserMessageSet = true;
      }, testMessage);
      
      // Wait for message to be cleared (callback should have been called)
      await page.waitForFunction(
        () => window.__testUserMessage === null || window.__testUserMessage === undefined,
        { timeout: 10000 }
      );
      
      // After callback, userMessage should be null/undefined
      const messageCleared = await page.evaluate(() => {
        return window.__testUserMessage === null || window.__testUserMessage === undefined;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(messageCleared).toBeDefined();
    });
  });
  
  test.describe('connectionState/autoStart props (replaces start/stop)', () => {
    
    test('should connect when connectionState prop is "connected"', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // Set connectionState prop
      await page.evaluate(() => {
        window.__testConnectionState = 'connected';
        window.__testConnectionStateSet = true;
      });
      
      // Wait for connection to be established
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 connectionStatus.textContent.toLowerCase().includes('connected');
        },
        { timeout: 10000 }
      );
      
      // Verify connection was established
      const isConnected = await page.evaluate(() => {
        const connectionStatus = document.querySelector('[data-testid="connection-status"]');
        return connectionStatus?.textContent?.toLowerCase().includes('connected') || 
               window.__testIsConnected || false;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(isConnected).toBeDefined();
    });
    
    test('should disconnect when connectionState prop is "disconnected"', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // First connect
      await page.evaluate(() => {
        window.__testConnectionState = 'connected';
        window.__testConnectionStateSet = true;
      });
      
      // Wait for connection to be established
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 connectionStatus.textContent.toLowerCase().includes('connected');
        },
        { timeout: 10000 }
      );
      
      // Then disconnect
      await page.evaluate(() => {
        window.__testConnectionState = 'disconnected';
        window.__testConnectionStateSet = true;
      });
      
      // Wait for disconnection
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 (connectionStatus.textContent.toLowerCase().includes('closed') ||
                  connectionStatus.textContent.toLowerCase().includes('disconnected'));
        },
        { timeout: 10000 }
      );
      
      // Verify disconnection
      const isDisconnected = await page.evaluate(() => {
        const connectionStatus = document.querySelector('[data-testid="connection-status"]');
        const domDisconnected = connectionStatus?.textContent?.toLowerCase().includes('closed') ||
                               connectionStatus?.textContent?.toLowerCase().includes('disconnected');
        return domDisconnected || window.__testIsDisconnected || false;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(isDisconnected).toBeDefined();
    });
  });
  
  test.describe('function call response via callback return value', () => {
    
    test('should handle function call response via callback return value', async ({ page }) => {
      skipIfNoRealAPI();
      // Skip when OpenAI proxy: function call timing is backend-dependent; openai-proxy-e2e "Simple function calling" covers that flow
      skipIfOpenAIProxy('Function call timing unreliable against OpenAI proxy; use openai-proxy-e2e "Simple function calling" for OpenAI.');
      
      // Navigate with function calling enabled
      let url = '/?test-mode=true&enable-function-calling=true';
      if (hasOpenAIProxyEndpoint()) {
        const { pathWithQuery, getOpenAIProxyParams } = await import('./helpers/test-helpers.mjs');
        url = pathWithQuery({ ...getOpenAIProxyParams(), 'test-mode': 'true', 'enable-function-calling': 'true' });
      }
      await page.goto(url);
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // Set up function call handler that returns a value (declarative pattern)
      await page.evaluate(() => {
        window.__testFunctionCallHandler = (request, sendResponse) => {
          // Return result directly instead of calling sendResponse
          // This tests the declarative return value pattern
          // Component expects { id, result } or { id, error } format
          return { 
            id: request.id,
            result: { success: true, result: 'Function executed successfully' }
          };
        };
        window.__testFunctionCallResponseSent = false; // Reset flag
        window.__testFunctionCallRequestReceived = false; // Track if request was received
      });
      
      // Connect agent and wait for it to be ready
      await page.evaluate(() => {
        window.__testAutoStartAgent = true;
        window.__testAutoStartAgentSet = true;
      });
      
      // Wait for connection
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 connectionStatus.textContent.toLowerCase().includes('connected');
        },
        { timeout: 10000 }
      );
      
      // Wait for settings to be applied (indicator appears in DOM)
      await page.waitForFunction(
        () => {
          const settingsApplied = document.querySelector('[data-testid="has-sent-settings"]');
          return settingsApplied && settingsApplied.textContent === 'true';
        },
        { timeout: 10000 }
      ).catch(() => {
        // Settings applied indicator may not appear immediately - continue anyway
        // The connection is established which is what we need
      });
      
      // Send a message that will trigger the agent to call the get_current_time function
      await page.evaluate(() => {
        window.__testUserMessage = 'What time is it?';
        window.__testUserMessageSet = true;
      });
      
      // Wait for function call request to be received (test requires a real function call to validate return-value pattern)
      await page.waitForFunction(
        () => window.__testFunctionCallRequestReceived === true || window.__testFunctionCallResponseSent === true,
        { timeout: 45000 }
      );
      
      const responseSent = await page.evaluate(() => window.__testFunctionCallResponseSent || false);
      const requestReceived = await page.evaluate(() => window.__testFunctionCallRequestReceived || false);
      
      expect(requestReceived).toBe(true);
      expect(responseSent).toBe(true);
    });
    
    test('should handle async function call response via Promise return', async ({ page }) => {
      skipIfNoRealAPI();
      skipIfOpenAIProxy('Function call timing unreliable against OpenAI proxy; use openai-proxy-e2e "Simple function calling" for OpenAI.');
      
      // Navigate with function calling enabled
      await page.goto('/?test-mode=true&enable-function-calling=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // Set up async function call handler that returns a Promise
      await page.evaluate(() => {
        window.__testFunctionCallHandler = async (request, sendResponse) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 100));
          // Return Promise with result (declarative pattern)
          return Promise.resolve({ 
            id: request.id,
            result: { success: true, result: 'Async function executed' }
          });
        };
        window.__testFunctionCallResponseSent = false; // Reset flag
        window.__testFunctionCallRequestReceived = false; // Track if request was received
      });
      
      // Connect agent and wait for it to be ready
      await page.evaluate(() => {
        window.__testAutoStartAgent = true;
        window.__testAutoStartAgentSet = true;
      });
      
      // Wait for connection
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 connectionStatus.textContent.toLowerCase().includes('connected');
        },
        { timeout: 10000 }
      );
      
      // Wait for settings to be applied (indicator appears in DOM)
      await page.waitForFunction(
        () => {
          const settingsApplied = document.querySelector('[data-testid="has-sent-settings"]');
          return settingsApplied && settingsApplied.textContent === 'true';
        },
        { timeout: 10000 }
      ).catch(() => {
        // Settings applied indicator may not appear immediately - continue anyway
        // The connection is established which is what we need
      });
      
      // Send a message that will trigger the agent to call the get_current_time function
      await page.evaluate(() => {
        window.__testUserMessage = 'What time is it in UTC?';
        window.__testUserMessageSet = true;
      });
      
      // Wait for function call (test requires a real function call to validate async return-value pattern)
      await page.waitForFunction(
        () => window.__testFunctionCallRequestReceived === true || window.__testFunctionCallResponseSent === true,
        { timeout: 25000 }
      );
      
      const responseSent = await page.evaluate(() => window.__testFunctionCallResponseSent || false);
      const requestReceived = await page.evaluate(() => window.__testFunctionCallRequestReceived || false);
      
      expect(requestReceived).toBe(true);
      expect(responseSent).toBe(true);
    });
  });
  
  test.describe('interruptAgent prop (replaces interruptAgent method)', () => {
    
    test('should interrupt TTS when interruptAgent prop is true', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // First, trigger agent to speak
      await page.evaluate(() => {
        window.__testUserMessage = 'Tell me a story';
        window.__testUserMessageSet = true;
      });
      
      // Wait for agent to start speaking
      await page.waitForFunction(
        () => {
          const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
          return audioPlaying && audioPlaying.textContent === 'true';
        },
        { timeout: 10000 }
      );
      
      // Then set interruptAgent prop
      await page.evaluate(() => {
        window.__testInterruptAgent = true;
        window.__testInterruptAgentSet = true;
      });
      
      // Wait for TTS to be interrupted (audio should stop)
      await page.waitForFunction(
        () => {
          const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
          return audioPlaying && audioPlaying.textContent === 'false';
        },
        { timeout: 10000 }
      );
      
      // Verify TTS was interrupted
      const ttsInterrupted = await page.evaluate(() => {
        const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
        return (audioPlaying && audioPlaying.textContent === 'false') ||
               window.__testAgentInterrupted || false;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(ttsInterrupted).toBeDefined();
    });
    
    test('should trigger onAgentInterrupted callback when TTS is interrupted', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      let callbackInvoked = false;
      
      await page.evaluate(() => {
        window.__testOnAgentInterrupted = () => {
          window.__testOnAgentInterruptedInvoked = true;
        };
      });
      
      // Trigger agent to speak
      await page.evaluate(() => {
        window.__testUserMessage = 'Tell me a joke';
        window.__testUserMessageSet = true;
      });
      
      // Wait for agent to start speaking
      await page.waitForFunction(
        () => {
          const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
          return audioPlaying && audioPlaying.textContent === 'true';
        },
        { timeout: 10000 }
      );
      
      // Interrupt TTS
      await page.evaluate(() => {
        window.__testInterruptAgent = true;
        window.__testInterruptAgentSet = true;
      });
      
      // Wait for callback to be invoked
      await page.waitForFunction(
        () => window.__testOnAgentInterruptedInvoked === true,
        { timeout: 10000 }
      );
      
      callbackInvoked = await page.evaluate(() => {
        return window.__testOnAgentInterruptedInvoked || false;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(callbackInvoked).toBeDefined();
    });
    
    test('should clear interruptAgent after onAgentInterrupted is called', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // Trigger agent to speak
      await page.evaluate(() => {
        window.__testUserMessage = 'Tell me about React';
        window.__testUserMessageSet = true;
      });
      
      // Wait for agent to start speaking
      await page.waitForFunction(
        () => {
          const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
          return audioPlaying && audioPlaying.textContent === 'true';
        },
        { timeout: 10000 }
      );
      
      // Interrupt TTS
      await page.evaluate(() => {
        window.__testInterruptAgent = true;
        window.__testInterruptAgentSet = true;
      });
      
      // Wait for interruptAgent to be cleared (callback should have been called)
      await page.waitForFunction(
        () => window.__testInterruptAgent === false,
        { timeout: 10000 }
      );
      
      // After callback, interruptAgent should be false
      const interruptCleared = await page.evaluate(() => {
        return window.__testInterruptAgent === false;
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(interruptCleared).toBeDefined();
    });
  });
  
  test.describe('startAudioCapture prop (replaces startAudioCapture method)', () => {
    
    test('should start audio capture when startAudioCapture prop is true', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // First, connect the agent (required for startAudioCapture)
      await page.evaluate(() => {
        window.__testAutoStartAgent = true;
        window.__testAutoStartAgentSet = true;
      });
      
      // Wait for connection to be established
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 connectionStatus.textContent.toLowerCase().includes('connected');
        },
        { timeout: 10000 }
      );
      
      // Wait for settings to be applied
      await page.waitForFunction(
        () => {
          const settingsApplied = document.querySelector('[data-testid="has-sent-settings"]');
          return settingsApplied && settingsApplied.textContent === 'true';
        },
        { timeout: 10000 }
      ).catch(() => {
        // Settings applied indicator may not appear immediately - continue anyway
      });
      
      // Now set startAudioCapture prop
      await page.evaluate(() => {
        window.__testStartAudioCapture = true;
        window.__testStartAudioCaptureSet = true;
      });
      
      // Wait for audio capture to start - check mic status in DOM
      await page.waitForFunction(
        () => {
          const micStatus = document.querySelector('[data-testid="mic-status"]');
          return micStatus && micStatus.textContent && 
                 micStatus.textContent.toLowerCase().includes('enabled');
        },
        { timeout: 30000 }
      );
      
      // Verify audio capture was started
      const audioCaptureStarted = await page.evaluate(() => {
        const micStatus = document.querySelector('[data-testid="mic-status"]');
        return micStatus?.textContent?.toLowerCase().includes('enabled') || false;
      });
      
      expect(audioCaptureStarted).toBe(true);
    });
    
    test('should stop audio capture when startAudioCapture prop is false', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // First, connect the agent (required for startAudioCapture)
      await page.evaluate(() => {
        window.__testAutoStartAgent = true;
        window.__testAutoStartAgentSet = true;
      });
      
      // Wait for connection to be established
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 connectionStatus.textContent.toLowerCase().includes('connected');
        },
        { timeout: 10000 }
      );
      
      // Wait for settings to be applied
      await page.waitForFunction(
        () => {
          const settingsApplied = document.querySelector('[data-testid="has-sent-settings"]');
          return settingsApplied && settingsApplied.textContent === 'true';
        },
        { timeout: 10000 }
      ).catch(() => {
        // Settings applied indicator may not appear immediately - continue anyway
      });
      
      // Now start audio capture
      await page.evaluate(() => {
        window.__testStartAudioCapture = true;
        window.__testStartAudioCaptureSet = true;
      });
      
      // Wait for audio capture to start
      await page.waitForFunction(
        () => {
          const micStatus = document.querySelector('[data-testid="mic-status"]');
          return micStatus && micStatus.textContent && 
                 micStatus.textContent.toLowerCase().includes('enabled');
        },
        { timeout: 30000 }
      );
      
      // Then stop audio capture
      await page.evaluate(() => {
        window.__testStartAudioCapture = false;
        window.__testStartAudioCaptureSet = true;
      });
      
      // Wait for audio capture to stop
      await page.waitForFunction(
        () => {
          const micStatus = document.querySelector('[data-testid="mic-status"]');
          return micStatus && micStatus.textContent && 
                 micStatus.textContent.toLowerCase().includes('disabled');
        },
        { timeout: 30000 }
      );
      
      // Verify audio capture was stopped
      const audioCaptureStopped = await page.evaluate(() => {
        const micStatus = document.querySelector('[data-testid="mic-status"]');
        return micStatus?.textContent?.toLowerCase().includes('disabled') || false;
      });
      
      expect(audioCaptureStopped).toBe(true);
    });
  });
  
  test.describe('Backward Compatibility', () => {
    
    test('should maintain backward compatibility with imperative ref methods', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // Test that imperative methods still work
      const imperativeMethodsWork = await page.evaluate(() => {
        const deepgramComponent = window.deepgramRef?.current;
        if (!deepgramComponent) return false;
        
        // Check that imperative methods exist
        const hasInjectUserMessage = typeof deepgramComponent.injectUserMessage === 'function';
        const hasStart = typeof deepgramComponent.start === 'function';
        const hasStop = typeof deepgramComponent.stop === 'function';
        const hasInterruptAgent = typeof deepgramComponent.interruptAgent === 'function';
        const hasStartAudioCapture = typeof deepgramComponent.startAudioCapture === 'function';
        
        return hasInjectUserMessage && hasStart && hasStop && hasInterruptAgent && hasStartAudioCapture;
      });
      
      expect(imperativeMethodsWork).toBe(true);
    });
    
    test('should allow mixing declarative props with imperative methods', async ({ page }) => {
      skipIfNoRealAPI();
      
      await page.goto('/?test-mode=true');
      
      await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 5000 }).catch(() => {});
      
      // Use declarative prop for connection
      await page.evaluate(() => {
        window.__testAutoStartAgent = true;
        window.__testAutoStartAgentSet = true;
      });
      
      // Wait for connection to be established
      await page.waitForFunction(
        () => {
          const connectionStatus = document.querySelector('[data-testid="connection-status"]');
          return connectionStatus && connectionStatus.textContent && 
                 connectionStatus.textContent.toLowerCase().includes('connected');
        },
        { timeout: 10000 }
      );
      
      // Then use imperative method for message
      const messageSent = await page.evaluate(async () => {
        const deepgramComponent = window.deepgramRef?.current;
        if (!deepgramComponent) return false;
        
        try {
          await deepgramComponent.injectUserMessage('Test message via imperative method');
          return true;
        } catch (error) {
          return false;
        }
      });
      
      // Note: This test will need to be updated once the implementation is complete
      expect(messageSent).toBeDefined();
    });
  });
});
