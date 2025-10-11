/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocketManager to track connection calls
const mockTranscriptionManager = {
  addEventListener: jest.fn(),
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn(),
  close: jest.fn(),
  sendBinary: jest.fn(),
  sendJSON: jest.fn(),
  getState: jest.fn().mockReturnValue('connected')
};

const mockAgentManager = {
  addEventListener: jest.fn(),
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn(),
  close: jest.fn(),
  sendBinary: jest.fn(),
  sendJSON: jest.fn(),
  getState: jest.fn().mockReturnValue('connected')
};

// Mock the WebSocketManager modules
jest.mock('../src/utils/websocket/WebSocketManager', () => {
  return {
    WebSocketManager: jest.fn((config) => {
      if (config.service === 'transcription') {
        return mockTranscriptionManager;
      } else if (config.service === 'agent') {
        return mockAgentManager;
      }
      return {};
    })
  };
});

describe('Auto-Connect Dual Mode Bug Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect BOTH transcription and agent WebSockets in auto-connect dual mode', async () => {
    render(
      <DeepgramVoiceInteraction
        apiKey="test-key"
        transcriptionOptions={{
          model: 'nova-2',
          language: 'en-US',
          interim_results: true
        }}
        agentOptions={{
          model: 'nova-3',
          language: 'en-US',
          instructions: 'Test instructions'
        }}
        autoConnect={true} // Enable auto-connect dual mode
      />
    );

    // Wait for auto-connect timeout to execute
    await waitFor(() => {
      expect(mockTranscriptionManager.connect).toHaveBeenCalled();
    }, { timeout: 200 });

    // Verify BOTH WebSockets are connected in auto-connect dual mode
    expect(mockTranscriptionManager.connect).toHaveBeenCalledTimes(1);
    expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);
  });

  it('should connect BOTH WebSockets in manual start() mode', async () => {
    const componentRef = React.createRef();
    
    render(
      <DeepgramVoiceInteraction
        ref={componentRef}
        apiKey="test-key"
        transcriptionOptions={{
          model: 'nova-2',
          language: 'en-US',
          interim_results: true
        }}
        agentOptions={{
          model: 'nova-3',
          language: 'en-US',
          instructions: 'Test instructions'
        }}
        autoConnect={false} // Disable auto-connect
      />
    );

    // Call start() manually
    await componentRef.current?.start();

    // Verify BOTH WebSockets are connected in manual mode
    expect(mockTranscriptionManager.connect).toHaveBeenCalledTimes(1);
    expect(mockAgentManager.connect).toHaveBeenCalledTimes(1);
  });
});
