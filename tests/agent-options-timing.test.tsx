/**
 * Integration test to demonstrate React re-render timing issue
 * 
 * This test reproduces the issue where:
 * 1. Component receives agentOptions prop without functions (initial render)
 * 2. Connection is established and Settings is sent (using stale agentOptions)
 * 3. Later, agentOptions is updated to include functions
 * 4. But Settings was already sent without functions
 * 
 * Expected behavior: Component should re-send Settings when agentOptions changes
 * Current behavior: Settings is sent once and never updated
 */

/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React, { useMemo, useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager, MOCK_API_KEY } from './fixtures/mocks';

// Mock WebSocket and Audio managers
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('AgentOptions Timing Issue', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;
  let capturedSettings: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    capturedSettings = [];
    
    // Reset global flags
    (window as any).globalSettingsSent = false;
    
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    
    // Capture Settings messages
    mockWebSocketManager.sendJSON.mockImplementation((message) => {
      const parsed = typeof message === 'string' ? JSON.parse(message) : message;
      if (parsed.type === 'Settings') {
        capturedSettings.push(parsed);
      }
      return Promise.resolve();
    });
    
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    capturedSettings = [];
  });

  /**
   * Test component that simulates the timing issue:
   * - Initially renders with agentOptions without functions
   * - Then updates agentOptions to include functions
   * - Verifies that Settings is re-sent with functions
   */
  const TestComponent: React.FC<{ initialHasFunctions: boolean; ref?: React.Ref<DeepgramVoiceInteractionHandle> }> = ({ initialHasFunctions, ref: externalRef }) => {
    const [hasFunctions, setHasFunctions] = useState(initialHasFunctions);
    const componentRef = React.useRef<DeepgramVoiceInteractionHandle>(null);
    const ref = externalRef || componentRef;

    const agentOptions = useMemo(() => {
      return {
        language: 'en',
        listenModel: 'nova-3',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        ...(hasFunctions ? {
          functions: [
            {
              name: 'test',
              description: 'test',
              parameters: {
                type: 'object',
                properties: {}
              }
            }
          ]
        } : {})
      };
    }, [hasFunctions]);

    React.useEffect(() => {
      // Simulate the timing issue: update agentOptions after a delay
      // This mimics what happens when memoizedAgentOptions recomputes
      if (!initialHasFunctions) {
        const timer = setTimeout(() => {
          setHasFunctions(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [initialHasFunctions]);

    return (
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={MOCK_API_KEY}
        agentOptions={agentOptions}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent' && state === 'connected') {
            // Connection established - Settings should be sent
          }
        }}
      />
    );
  };

  test('should re-send Settings when agentOptions.functions is added after initial render', async () => {
    // This test demonstrates the timing issue:
    // 1. Component renders with agentOptions without functions
    // 2. Connection is established and Settings is sent (without functions)
    // 3. agentOptions is updated to include functions
    // 4. Component should re-send Settings with functions
    
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    await act(async () => {
      render(
        <TestComponent initialHasFunctions={false} ref={ref} />
      );
    });

    // Start the connection
    await act(async () => {
      await ref.current?.start({ agent: true });
    });

    // Wait for event listener to be set up
    await waitFor(() => {
      expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
    });

    // Find the event listener
    const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
      call => typeof call[0] === 'function'
    )?.[0];

    expect(eventListener).toBeDefined();

    // Simulate connection state change to 'connected' to trigger settings send
    if (eventListener) {
      await act(async () => {
        eventListener({ type: 'state', state: 'connected' });
      });
    }

    // Wait for connection to be established and Settings to be sent
    await waitFor(() => {
      expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Get the first Settings message (should be without functions)
    const firstSettings = capturedSettings[0];
    expect(firstSettings).toBeDefined();
    expect(firstSettings.type).toBe('Settings');
    
    // Verify first Settings does NOT have functions
    const firstHasFunctions = firstSettings.agent?.think?.functions && 
                              firstSettings.agent.think.functions.length > 0;
    expect(firstHasFunctions).toBe(false);

    // Wait for agentOptions to be updated with functions
    await waitFor(() => {
      // Check if a second Settings message was sent with functions
      const settingsWithFunctions = capturedSettings.find(s => 
        s.agent?.think?.functions && s.agent.think.functions.length > 0
      );
      return settingsWithFunctions !== undefined;
    }, { timeout: 2000 });

    // Verify that Settings was re-sent with functions
    const settingsWithFunctions = capturedSettings.find(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    // THIS IS THE EXPECTED BEHAVIOR (currently fails):
    expect(settingsWithFunctions).toBeDefined();
    expect(settingsWithFunctions?.agent?.think?.functions?.length).toBe(1);
    expect(settingsWithFunctions?.agent?.think?.functions?.[0]?.name).toBe('test');
  });

  test('should send Settings with functions when agentOptions includes functions from start', async () => {
    // This test verifies the happy path: functions are included from the beginning
    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    await act(async () => {
      render(
        <TestComponent initialHasFunctions={true} ref={ref} />
      );
    });

    // Start the connection
    await act(async () => {
      await ref.current?.start({ agent: true });
    });

    // Wait for event listener to be set up
    await waitFor(() => {
      expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
    });

    // Find the event listener
    const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
      call => typeof call[0] === 'function'
    )?.[0];

    expect(eventListener).toBeDefined();

    // Simulate connection state change to 'connected' to trigger settings send
    if (eventListener) {
      await act(async () => {
        eventListener({ type: 'state', state: 'connected' });
      });
    }

    // Wait for connection to be established and Settings to be sent
    await waitFor(() => {
      expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Get the Settings message (should include functions)
    const settings = capturedSettings[0];
    expect(settings).toBeDefined();
    expect(settings.type).toBe('Settings');
    
    // Verify Settings HAS functions
    expect(settings.agent?.think?.functions).toBeDefined();
    expect(settings.agent.think.functions.length).toBe(1);
    expect(settings.agent.think.functions[0].name).toBe('test');
  });

  test('should detect when agentOptions changes and re-send Settings', async () => {
    // This test verifies that the component detects agentOptions changes
    // and re-sends Settings when functions are added
    
  const TestComponentWithUpdate: React.FC<{ ref?: React.Ref<DeepgramVoiceInteractionHandle> }> = ({ ref: externalRef }) => {
    const [step, setStep] = useState<'initial' | 'updated'>('initial');
    const componentRef = React.useRef<DeepgramVoiceInteractionHandle>(null);
    const ref = externalRef || componentRef;

      const agentOptions = useMemo(() => {
        if (step === 'initial') {
          return {
            language: 'en',
            listenModel: 'nova-3',
            thinkProviderType: 'open_ai',
            thinkModel: 'gpt-4o-mini',
            voice: 'aura-asteria-en',
            instructions: 'You are a helpful assistant.',
            // No functions initially
          };
        } else {
          return {
            language: 'en',
            listenModel: 'nova-3',
            thinkProviderType: 'open_ai',
            thinkModel: 'gpt-4o-mini',
            voice: 'aura-asteria-en',
            instructions: 'You are a helpful assistant.',
            functions: [
              {
                name: 'test',
                description: 'test',
                parameters: {
                  type: 'object',
                  properties: {}
                }
              }
            ]
          };
        }
      }, [step]);

      React.useEffect(() => {
        // After connection is established, update agentOptions
        const timer = setTimeout(() => {
          setStep('updated');
        }, 200);
        return () => clearTimeout(timer);
      }, []);

      return (
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );
    };

    const ref = React.createRef<DeepgramVoiceInteractionHandle>();
    
    await act(async () => {
      render(<TestComponentWithUpdate ref={ref} />);
    });

    // Start the connection
    await act(async () => {
      await ref.current?.start({ agent: true });
    });

    // Wait for event listener to be set up
    await waitFor(() => {
      expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
    });

    // Find the event listener
    const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
      call => typeof call[0] === 'function'
    )?.[0];

    expect(eventListener).toBeDefined();

    // Simulate connection state change to 'connected' to trigger settings send
    if (eventListener) {
      await act(async () => {
        eventListener({ type: 'state', state: 'connected' });
      });
    }

    // Wait for first Settings (without functions)
    await waitFor(() => {
      expect(capturedSettings.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const firstSettings = capturedSettings[0];
    expect(firstSettings.agent?.think?.functions).toBeUndefined();

    // Wait for second Settings (with functions) - THIS SHOULD HAPPEN BUT CURRENTLY DOESN'T
    await waitFor(() => {
      const settingsWithFunctions = capturedSettings.find(s => 
        s.agent?.think?.functions && s.agent.think.functions.length > 0
      );
      return settingsWithFunctions !== undefined;
    }, { timeout: 2000 });

    // Verify that Settings was re-sent with functions
    const settingsWithFunctions = capturedSettings.find(s => 
      s.agent?.think?.functions && s.agent.think.functions.length > 0
    );
    
    // THIS IS THE EXPECTED BEHAVIOR (currently fails):
    expect(settingsWithFunctions).toBeDefined();
    expect(settingsWithFunctions?.agent?.think?.functions?.length).toBe(1);
  });
});

