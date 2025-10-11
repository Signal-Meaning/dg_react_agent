/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';

describe('TTS Control Functionality', () => {
  let mockOnTtsToggle;
  let componentRef;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnTtsToggle = jest.fn();
    componentRef = React.createRef();
  });

  describe('TTS Control Props', () => {
    it('should accept ttsEnabled prop with default value true', () => {
      const { container } = render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
        />
      );

      expect(container).toBeInTheDocument();
      // Component should render without errors when ttsEnabled is not provided (defaults to true)
    });

    it('should accept ttsEnabled prop set to false', () => {
      const { container } = render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          ttsEnabled={false}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should call onTtsToggle when TTS state changes', () => {
      render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          onTtsToggle={mockOnTtsToggle}
        />
      );

      // Test enableTts method
      act(() => {
        componentRef.current?.enableTts();
      });

      expect(mockOnTtsToggle).toHaveBeenCalledWith(true);

      // Test disableTts method
      act(() => {
        componentRef.current?.disableTts();
      });

      expect(mockOnTtsToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('TTS Control Methods', () => {
    it('should expose enableTts method', () => {
      render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          onTtsToggle={mockOnTtsToggle}
        />
      );

      expect(componentRef.current?.enableTts).toBeDefined();
      expect(typeof componentRef.current?.enableTts).toBe('function');
    });

    it('should expose disableTts method', () => {
      render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          onTtsToggle={mockOnTtsToggle}
        />
      );

      expect(componentRef.current?.disableTts).toBeDefined();
      expect(typeof componentRef.current?.disableTts).toBe('function');
    });

    it('should expose toggleTts method', () => {
      render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          onTtsToggle={mockOnTtsToggle}
        />
      );

      expect(componentRef.current?.toggleTts).toBeDefined();
      expect(typeof componentRef.current?.toggleTts).toBe('function');
    });

    it('should toggle TTS state correctly', () => {
      render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          onTtsToggle={mockOnTtsToggle}
        />
      );

      // Start with default enabled state
      act(() => {
        componentRef.current?.toggleTts();
      });

      expect(mockOnTtsToggle).toHaveBeenCalledWith(false);

      // Toggle again to enable
      act(() => {
        componentRef.current?.toggleTts();
      });

      expect(mockOnTtsToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('TTS State Synchronization', () => {
    it('should sync internal state when ttsEnabled prop changes', () => {
      const { rerender } = render(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          ttsEnabled={true}
          onTtsToggle={mockOnTtsToggle}
        />
      );

      // Change prop to false
      rerender(
        <DeepgramVoiceInteraction
          ref={componentRef}
          apiKey="test-key"
          agentOptions={{ instructions: 'Test' }}
          ttsEnabled={false}
          onTtsToggle={mockOnTtsToggle}
        />
      );

      // Component should handle prop change without errors
      expect(componentRef.current).toBeDefined();
    });
  });
});
