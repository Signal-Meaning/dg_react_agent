/**
 * Component Test Helpers
 * 
 * DRY utilities for testing DeepgramVoiceInteraction component.
 * Reduces duplication across test files.
 */

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { act, waitFor as rtlWaitFor } from '@testing-library/react';
import DeepgramVoiceInteraction from '../../src/components/DeepgramVoiceInteraction';
import { DeepgramVoiceInteractionHandle, AgentOptions, AgentFunction } from '../../src/types';
import { MOCK_API_KEY } from '../fixtures/mocks';

// Re-export MOCK_API_KEY and waitFor for convenience
export { MOCK_API_KEY };
export { rtlWaitFor as waitFor };

/**
 * Type definitions for captured Settings messages
 */
export interface CapturedSettingsMessage {
  type: 'Settings';
  agent?: {
    think?: {
      functions?: AgentFunction[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export type CapturedSettings = Array<CapturedSettingsMessage>;

/**
 * Extend Window interface for test state
 */
declare global {
  interface Window {
    globalSettingsSent?: boolean;
    __DEEPGRAM_TEST_MODE__?: boolean;
    __DEEPGRAM_DEBUG_AGENT_OPTIONS__?: boolean;
    __testReferenceChangeCount?: number;
    __testRenderCount?: number;
  }
}

/**
 * Mock WebSocket Manager type
 */
export type MockWebSocketManager = {
  addEventListener: jest.Mock;
  sendJSON: jest.Mock;
  getState: jest.Mock;
  connect: jest.Mock;
  [key: string]: any;
};

/**
 * Wait for event listener to be set up and return it
 */
export async function waitForEventListener(
  mockWebSocketManager: MockWebSocketManager
): Promise<((event: any) => void) | undefined> {
  await rtlWaitFor(() => {
    expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
  });

  const eventListener = mockWebSocketManager.addEventListener.mock.calls.find(
    (call) => typeof call[0] === 'function'
  )?.[0];

  expect(eventListener).toBeDefined();
  return eventListener;
}

/**
 * Simulate connection state change to 'connected'
 */
export async function simulateConnection(
  eventListener: ((event: any) => void) | undefined,
  mockWebSocketManager?: MockWebSocketManager
): Promise<void> {
  if (eventListener) {
    await act(async () => {
      eventListener({ type: 'state', state: 'connected' });
    });
    // Ensure mock manager state is updated
    if (mockWebSocketManager) {
      mockWebSocketManager.getState.mockReturnValue('connected');
    }
  }
}

/**
 * Simulate receiving a SettingsApplied message from Deepgram
 */
export async function simulateSettingsApplied(
  eventListener: ((event: any) => void) | undefined
): Promise<void> {
  if (eventListener) {
    await act(async () => {
      eventListener({ type: 'message', data: { type: 'SettingsApplied' } });
    });
  }
}

/**
 * Complete flow: Setup, connect, send Settings, and receive SettingsApplied
 */
export async function setupConnectAndReceiveSettingsApplied(
  ref: React.RefObject<DeepgramVoiceInteractionHandle>,
  mockWebSocketManager: MockWebSocketManager
): Promise<((event: any) => void) | undefined> {
  const eventListener = await setupComponentAndConnect(ref, mockWebSocketManager);
  await simulateSettingsApplied(eventListener);
  return eventListener;
}

/**
 * Wait for Settings message to be sent
 */
export async function waitForSettingsSent(
  mockWebSocketManager: MockWebSocketManager,
  timeout = 3000
): Promise<void> {
  await rtlWaitFor(() => {
    expect(mockWebSocketManager.sendJSON).toHaveBeenCalled();
  }, { timeout });
}

/**
 * Complete flow: Start component, wait for listener, simulate connection, wait for Settings
 */
export async function setupComponentAndConnect(
  ref: React.RefObject<DeepgramVoiceInteractionHandle>,
  mockWebSocketManager: MockWebSocketManager,
  options: { agent?: boolean; transcription?: boolean } = { agent: true }
): Promise<((event: any) => void) | undefined> {
  // Clear globalSettingsSent flag BEFORE starting connection
  // This allows Settings to be sent (component checks this flag)
  window.globalSettingsSent = false;
  
  // Issue #345: Ensure mock hasSettingsBeenSent method returns true after Settings is sent
  // This allows injectUserMessage to proceed (it waits for Settings to be sent)
  if (mockWebSocketManager.hasSettingsBeenSent) {
    mockWebSocketManager.hasSettingsBeenSent.mockReturnValue(true);
  }
  
  // Start the connection
  await act(async () => {
    await ref.current?.start(options);
  });

  // Wait for event listener
  const eventListener = await waitForEventListener(mockWebSocketManager);

  // Simulate connection (and update mock state)
  await simulateConnection(eventListener, mockWebSocketManager);

  // Wait for Settings to be sent
  await waitForSettingsSent(mockWebSocketManager);
  
  // Issue #345: Simulate SettingsApplied to set hasSentSettingsRef and globalSettingsSent
  // This ensures injectUserMessage can proceed (it waits for Settings confirmation)
  await simulateSettingsApplied(eventListener);
  
  // Ensure globalSettingsSent flag is set after SettingsApplied (component uses this)
  window.globalSettingsSent = true;
  
  // Issue #345: Ensure mock hasSettingsBeenSent returns true (Settings was sent to WebSocket)
  // This allows injectUserMessage to proceed (it checks this method)
  if (mockWebSocketManager.hasSettingsBeenSent) {
    mockWebSocketManager.hasSettingsBeenSent.mockReturnValue(true);
  }
  
  return eventListener;
}

/**
 * Capture Settings messages from sendJSON calls
 */
export function createSettingsCapture(
  mockWebSocketManager: MockWebSocketManager
): CapturedSettings {
  const captured: CapturedSettings = [];

  // Get existing implementation if any (to support chaining)
  const existingImpl = mockWebSocketManager.sendJSON.getMockImplementation();

  mockWebSocketManager.sendJSON.mockImplementation((message) => {
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;
    if (parsed.type === 'Settings') {
      captured.push(parsed as CapturedSettingsMessage);
    }
    // Call existing implementation if it exists (supports chaining)
    if (existingImpl) {
      return existingImpl(message);
    }
    return Promise.resolve();
  });

  return captured;
}

/**
 * Find Settings message with functions
 * DRY helper to replace repeated find() patterns
 */
export function findSettingsWithFunctions(
  capturedSettings: CapturedSettings
): CapturedSettingsMessage | undefined {
  return capturedSettings.find(s => 
    s.type === 'Settings' &&
    s.agent?.think?.functions && 
    s.agent.think.functions.length > 0
  );
}

/**
 * Find Settings message without functions
 * DRY helper to replace repeated find() patterns
 */
export function findSettingsWithoutFunctions(
  capturedSettings: CapturedSettings
): CapturedSettingsMessage | undefined {
  return capturedSettings.find(s => {
    if (s.type !== 'Settings') return false;
    const hasFunctions = s.agent?.think?.functions && s.agent.think.functions.length > 0;
    return !hasFunctions;
  });
}

/**
 * Clear captured Settings array
 * DRY helper to replace repeated `capturedSettings.length = 0` patterns
 */
export function clearCapturedSettings(capturedSettings: CapturedSettings): void {
  capturedSettings.length = 0;
}

/**
 * Wait for Settings message with functions to be captured
 * Combines waitFor and findSettingsWithFunctions for common pattern
 */
export async function waitForSettingsWithFunctions(
  capturedSettings: CapturedSettings,
  timeout = 2000
): Promise<CapturedSettingsMessage> {
  await rtlWaitFor(() => {
    const settings = findSettingsWithFunctions(capturedSettings);
    expect(settings).toBeDefined();
  }, { timeout });
  
  const settings = findSettingsWithFunctions(capturedSettings);
  if (!settings) {
    throw new Error('Settings with functions not found after timeout');
  }
  return settings;
}

/**
 * Assert that Settings message has functions (type guard)
 * Provides better error messages and type safety
 * Properly narrows the type to ensure agent.think.functions is defined
 */
export function assertSettingsWithFunctions(
  settings: CapturedSettingsMessage | undefined,
  context?: string
): asserts settings is CapturedSettingsMessage & {
  agent: {
    think: {
      functions: AgentFunction[];
    };
  };
} {
  if (!settings) {
    const contextMsg = context ? ` (${context})` : '';
    throw new Error(`Settings with functions not found${contextMsg}`);
  }
  if (!settings.agent?.think?.functions || settings.agent.think.functions.length === 0) {
    const contextMsg = context ? ` (${context})` : '';
    throw new Error(`Settings does not have functions${contextMsg}`);
  }
}

/**
 * AgentOptions builder for tests
 */
export function createAgentOptions(overrides: Partial<AgentOptions> = {}): AgentOptions {
  return {
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    ...overrides,
  };
}

/**
 * Create minimal function for testing
 */
export function createMinimalFunction(): AgentFunction {
  return {
    name: 'test',
    description: 'test',
    parameters: {
      type: 'object',
      properties: {},
    },
  };
}

/**
 * Create agentOptions with functions
 */
export function createAgentOptionsWithFunctions(
  functions: AgentFunction[] = [createMinimalFunction()]
): AgentOptions {
  return createAgentOptions({ functions });
}

/**
 * Test component that can update agentOptions
 */
export interface TestComponentProps {
  initialAgentOptions: AgentOptions;
  updatedAgentOptions?: AgentOptions;
  onUpdateDelay?: number;
  componentRef?: React.Ref<DeepgramVoiceInteractionHandle>;
  onConnectionStateChange?: (service: string, state: string) => void;
}

export const TestComponentWithUpdatableOptions = React.forwardRef<
  DeepgramVoiceInteractionHandle,
  Omit<TestComponentProps, 'componentRef'>
>(({ initialAgentOptions, updatedAgentOptions, onUpdateDelay = 200, onConnectionStateChange }, externalRef) => {
  const [agentOptions, setAgentOptions] = useState<AgentOptions>(initialAgentOptions);
  const componentRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const ref = (externalRef || componentRef) as React.RefObject<DeepgramVoiceInteractionHandle>;

  const memoizedAgentOptions = useMemo(() => agentOptions, [agentOptions]);

  useEffect(() => {
    if (updatedAgentOptions) {
      const timer = setTimeout(() => {
        setAgentOptions(updatedAgentOptions);
      }, onUpdateDelay);
      return () => clearTimeout(timer);
    }
  }, [updatedAgentOptions, onUpdateDelay]);

  return (
    <DeepgramVoiceInteraction
      ref={ref}
      apiKey={MOCK_API_KEY}
      agentOptions={memoizedAgentOptions}
      onConnectionStateChange={onConnectionStateChange}
    />
  );
});

/**
 * Test component that starts with functions or without
 */
export interface TestComponentWithFunctionsProps {
  hasFunctions: boolean;
  componentRef?: React.Ref<DeepgramVoiceInteractionHandle>;
  onUpdateDelay?: number;
}

export const TestComponentWithFunctions = React.forwardRef<
  DeepgramVoiceInteractionHandle,
  Omit<TestComponentWithFunctionsProps, 'componentRef'>
>(({ hasFunctions: initialHasFunctions, onUpdateDelay = 100 }, externalRef) => {
  const [hasFunctions, setHasFunctions] = useState(initialHasFunctions);
  const componentRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const ref = (externalRef || componentRef) as React.RefObject<DeepgramVoiceInteractionHandle>;

  const agentOptions = useMemo(() => {
    return createAgentOptions(
      hasFunctions ? { functions: [createMinimalFunction()] } : {}
    );
  }, [hasFunctions]);

  useEffect(() => {
    if (!initialHasFunctions) {
      const timer = setTimeout(() => {
        setHasFunctions(true);
      }, onUpdateDelay);
      return () => clearTimeout(timer);
    }
  }, [initialHasFunctions, onUpdateDelay]);

  return (
    <DeepgramVoiceInteraction
      ref={ref}
      apiKey={MOCK_API_KEY}
      agentOptions={agentOptions}
    />
  );
});

/**
 * Reset global test state
 */
export function resetTestState(): void {
  window.globalSettingsSent = false;
}

/**
 * Verify Settings message structure
 */
export function verifySettingsStructure(settings: CapturedSettingsMessage | undefined): void {
  expect(settings).toBeDefined();
  expect(settings?.type).toBe('Settings');
  expect(settings?.agent).toBeDefined();
  expect(settings?.agent?.think).toBeDefined();
}

/**
 * Verify Settings has functions
 */
export function verifySettingsHasFunctions(
  settings: CapturedSettingsMessage | undefined,
  expectedCount?: number
): void {
  expect(settings).toBeDefined();
  expect(settings?.agent?.think?.functions).toBeDefined();
  expect(Array.isArray(settings?.agent?.think?.functions)).toBe(true);
  if (expectedCount !== undefined) {
    expect(settings?.agent?.think?.functions?.length).toBe(expectedCount);
  }
}

/**
 * Verify Settings does NOT have functions
 */
export function verifySettingsNoFunctions(settings: CapturedSettingsMessage | undefined): void {
  expect(settings).toBeDefined();
  const hasFunctions =
    settings?.agent?.think?.functions &&
    settings.agent.think.functions.length > 0;
  expect(hasFunctions).toBe(false);
}

