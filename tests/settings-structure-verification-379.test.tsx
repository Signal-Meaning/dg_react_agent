/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Issue #379: Settings message structure verification
 *
 * Tests that Settings payloads have the expected structure so that E2E and
 * unit tests can reliably assert on agent.context, agent.think, instructions,
 * and functions. Uses assertSettingsStructure from component-test-helpers.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { DeepgramVoiceInteractionHandle } from '../src/types';
import { createMockWebSocketManager, createMockAudioManager } from './fixtures/mocks';
import {
  resetTestState,
  createAgentOptions,
  createAgentOptionsWithFunctions,
  setupComponentAndConnect,
  createSettingsCapture,
  assertSettingsStructure,
  findSettingsWithFunctions,
  findSettingsWithoutFunctions,
  MOCK_API_KEY,
} from './utils/component-test-helpers';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

describe('Issue #379: Settings structure verification', () => {
  let mockWebSocketManager: ReturnType<typeof createMockWebSocketManager>;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTestState();
    mockWebSocketManager = createMockWebSocketManager();
    mockAudioManager = createMockAudioManager();
    WebSocketManager.mockImplementation(() => mockWebSocketManager);
    AudioManager.mockImplementation(() => mockAudioManager);
  });

  describe('assertSettingsStructure', () => {
    it('validates Settings with no context and no functions', async () => {
      const capturedSettings = createSettingsCapture(mockWebSocketManager);
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      const agentOptions = createAgentOptions();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );
      await setupComponentAndConnect(ref, mockWebSocketManager);
      expect(capturedSettings.length).toBeGreaterThan(0);
      const settings = findSettingsWithoutFunctions(capturedSettings) ?? capturedSettings[0];
      assertSettingsStructure(settings);
    });

    it('validates Settings with functions (requireFunctions)', async () => {
      const capturedSettings = createSettingsCapture(mockWebSocketManager);
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      const agentOptions = createAgentOptionsWithFunctions();

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );
      await setupComponentAndConnect(ref, mockWebSocketManager);
      const settings = findSettingsWithFunctions(capturedSettings);
      expect(settings).toBeDefined();
      assertSettingsStructure(settings, { requireFunctions: true });
    });

    it('validates agent.think.prompt (instructions) is present', async () => {
      const capturedSettings = createSettingsCapture(mockWebSocketManager);
      const ref = React.createRef<DeepgramVoiceInteractionHandle>();
      const customInstructions = 'You are a test assistant for Issue #379.';
      const agentOptions = createAgentOptions({ instructions: customInstructions });

      render(
        <DeepgramVoiceInteraction
          ref={ref}
          apiKey={MOCK_API_KEY}
          agentOptions={agentOptions}
        />
      );
      await setupComponentAndConnect(ref, mockWebSocketManager);
      expect(capturedSettings.length).toBeGreaterThan(0);
      const settings = capturedSettings[0];
      assertSettingsStructure(settings);
      expect(settings.agent?.think).toBeDefined();
      const prompt = (settings.agent!.think as { prompt?: string }).prompt;
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('test assistant');
    });

    it('throws when settings is undefined', () => {
      expect(() => assertSettingsStructure(undefined)).toThrow('Settings message is undefined');
    });
  });
});
