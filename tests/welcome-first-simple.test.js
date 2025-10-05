/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeepgramVoiceInteraction } from '../src';

// Mock the WebSocketManager and AudioManager
jest.mock('../src/utils/websocket/WebSocketManager');
jest.mock('../src/utils/audio/AudioManager');

// Set up default mocks that return unsubscribe functions
const mockUnsubscribe = jest.fn();
const { WebSocketManager } = require('../src/utils/websocket/WebSocketManager');
const { AudioManager } = require('../src/utils/audio/AudioManager');

WebSocketManager.mockImplementation(() => ({
  connect: jest.fn().mockResolvedValue(),
  close: jest.fn(),
  sendJSON: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe)
}));

AudioManager.mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue(),
  startRecording: jest.fn().mockResolvedValue(),
  stopRecording: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe),
  dispose: jest.fn()
}));

describe('Welcome-First Behavior - Simple Tests', () => {
  const defaultProps = {
    apiKey: 'test-api-key',
    agentOptions: {
      language: 'en',
      listenModel: 'nova-2',
      thinkProviderType: 'open_ai',
      thinkModel: 'gpt-4o-mini',
      voice: 'aura-asteria-en',
      instructions: 'You are a helpful assistant.',
      greeting: 'Hello! How can I help you today?'
    },
    debug: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render without crashing when autoConnect is true', () => {
    const { container } = render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        autoConnect={true}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  test('should render without crashing when autoConnect is false', () => {
    const { container } = render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        autoConnect={false}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  test('should render without crashing when microphoneEnabled is true', () => {
    const { container } = render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        microphoneEnabled={true}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  test('should render without crashing when microphoneEnabled is false', () => {
    const { container } = render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        microphoneEnabled={false}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  test('should call onReady when component initializes', async () => {
    const onReady = jest.fn();
    
    render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        onReady={onReady}
      />
    );

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(true);
    }, { timeout: 1000 });
  });

  test('should handle auto-connect dual mode props correctly', () => {
    const onConnectionReady = jest.fn();
    const onAgentSpeaking = jest.fn();
    const onAgentSilent = jest.fn();
    const onMicToggle = jest.fn();
    
    const { container } = render(
      <DeepgramVoiceInteraction
        {...defaultProps}
        autoConnect={true}
        microphoneEnabled={false}
        onConnectionReady={onConnectionReady}
        onAgentSpeaking={onAgentSpeaking}
        onAgentSilent={onAgentSilent}
        onMicToggle={onMicToggle}
      />
    );
    
    expect(container).toBeInTheDocument();
    // The component should render without errors when all auto-connect dual mode props are provided
  });
});
