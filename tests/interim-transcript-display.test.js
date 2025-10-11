/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

// Mock WebSocketManager to simulate receiving messages
const mockWebSocketManager = {
  addEventListener: jest.fn(),
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn(),
  close: jest.fn(), // Add missing close method
  sendBinary: jest.fn(),
  sendJSON: jest.fn(),
  getState: jest.fn().mockReturnValue('connected')
};

// Mock the WebSocketManager module
jest.mock('../src/utils/websocket/WebSocketManager', () => {
  return {
    WebSocketManager: jest.fn(() => mockWebSocketManager)
  };
});

describe('Interim Transcript Display - Root Cause Analysis', () => {
  let mockOnTranscriptUpdate;
  let componentRef;
  let messageHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnTranscriptUpdate = jest.fn();
    componentRef = React.createRef();
    
    // Capture the message handler when WebSocketManager is created
    mockWebSocketManager.addEventListener.mockImplementation((handler) => {
      messageHandler = handler;
      return jest.fn(); // unsubscribe function
    });
  });

  it('should demonstrate why Live Transcript never updates - Root Cause', async () => {
    // This test demonstrates the EXACT issue you're experiencing
    
    const { container } = render(
      <DeepgramVoiceInteraction
        ref={componentRef}
        apiKey="test-key"
        transcriptionOptions={{
          model: 'nova-2',
          language: 'en-US',
          interim_results: true,
          smart_format: true
        }}
        onTranscriptUpdate={mockOnTranscriptUpdate}
      />
    );

    expect(container).toBeInTheDocument();

    // Wait for component to initialize
    await waitFor(() => {
      expect(mockWebSocketManager.addEventListener).toHaveBeenCalled();
    });

    // Simulate what happens when you speak:
    // 1. Deepgram sends interim results (should update Live Transcript)
    // 2. Deepgram sends final results (should update User Message from Server)
    
    const interimResult = {
      type: 'Results',
      channel: {
        alternatives: [{
          transcript: 'Hello this is interim',
          confidence: 0.85,
          words: []
        }]
      },
      is_final: false // This is the key - interim results
    };

    const finalResult = {
      type: 'Results', 
      channel: {
        alternatives: [{
          transcript: 'Hello this is interim speech',
          confidence: 0.95,
          words: []
        }]
      },
      is_final: true // This is the key - final results
    };

    // Simulate receiving interim result from Deepgram WebSocket
    act(() => {
      messageHandler({
        type: 'message',
        data: interimResult
      });
    });

    // Simulate receiving final result from Deepgram WebSocket  
    act(() => {
      messageHandler({
        type: 'message',
        data: finalResult
      });
    });

    // THE ISSUE: Both interim and final results are passed to onTranscriptUpdate
    // But the test-app's handleTranscriptUpdate function treats them the same way
    // It only shows the LAST transcript received, not interim ones as they come in
    
    expect(mockOnTranscriptUpdate).toHaveBeenCalledTimes(2);
    
    const calls = mockOnTranscriptUpdate.mock.calls;
    
    // First call should be interim result
    expect(calls[0][0]).toEqual(interimResult);
    expect(calls[0][0].is_final).toBe(false);
    
    // Second call should be final result
    expect(calls[1][0]).toEqual(finalResult); 
    expect(calls[1][0].is_final).toBe(true);

    // THE ROOT CAUSE: The test-app's handleTranscriptUpdate function
    // doesn't distinguish between interim and final results
    // It just sets lastTranscript to whatever comes in
    // So "Live Transcript" only shows the final result, not interim ones
  });

  it('should show the test-app handleTranscriptUpdate issue', async () => {
    // This test shows exactly what the test-app is doing wrong
    
    let lastTranscript = '';
    let transcriptHistory = [];
    
    // This is what the test-app's handleTranscriptUpdate does:
    const testAppHandleTranscriptUpdate = (transcript) => {
      console.log('Full transcript response:', transcript);
      
      const deepgramResponse = transcript;
      
      if (deepgramResponse.channel?.alternatives?.[0]?.transcript) {
        const text = deepgramResponse.channel.alternatives[0].transcript;
        
        // THE PROBLEM: It always sets lastTranscript, regardless of is_final
        lastTranscript = text;
        transcriptHistory.push({ text, is_final: deepgramResponse.is_final });
        
        if (deepgramResponse.is_final) {
          console.log(`Final transcript: ${text}`);
        }
      }
    };

    // Simulate interim results coming in
    const interimResults = [
      { type: 'Results', channel: { alternatives: [{ transcript: 'Hello' }] }, is_final: false },
      { type: 'Results', channel: { alternatives: [{ transcript: 'Hello world' }] }, is_final: false },
      { type: 'Results', channel: { alternatives: [{ transcript: 'Hello world this' }] }, is_final: false }
    ];

    const finalResult = {
      type: 'Results',
      channel: { alternatives: [{ transcript: 'Hello world this is final' }] },
      is_final: true
    };

    // Process interim results
    interimResults.forEach(result => {
      testAppHandleTranscriptUpdate(result);
    });

    // Process final result
    testAppHandleTranscriptUpdate(finalResult);

    // THE ISSUE: lastTranscript only shows the final result
    // It doesn't show interim results as they come in
    expect(lastTranscript).toBe('Hello world this is final');
    expect(transcriptHistory).toHaveLength(4);
    
    // The test-app should show interim results in "Live Transcript" as they come in
    // But currently it only shows the last transcript received
    // This is why "Live Transcript" never updates while you're speaking
  });
});
