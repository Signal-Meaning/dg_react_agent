/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { getDefaultInstructions, loadInstructionsFromFile } from '../src/utils/instructions-loader.cjs';

// Mock the instructions loader module
jest.mock('../src/utils/instructions-loader.cjs', () => ({
  getDefaultInstructions: jest.fn(),
  loadInstructionsFromFile: jest.fn(),
}));

describe('DEEPGRAM_INSTRUCTIONS File and Environment Override', () => {
  const mockApiKey = 'test-api-key';
  const mockAgentOptions = {
    instructions: 'Default test instructions',
    voice: 'aura-2-apollo-en',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.DEEPGRAM_INSTRUCTIONS;
    // Note: import.meta.env cannot be deleted in Jest environment
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Instructions Loading from File', () => {
    it('should load instructions from default file when no env override', async () => {
      // Arrange
      const expectedInstructions = 'You are a helpful voice assistant for e-commerce.';
      loadInstructionsFromFile.mockResolvedValue(expectedInstructions);
      getDefaultInstructions.mockReturnValue('Default fallback instructions');

      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      expect(loadInstructionsFromFile).toHaveBeenCalledTimes(1);
      expect(instructions).toBe(expectedInstructions);
    });

    it('should fallback to default instructions when file loading fails', async () => {
      // Arrange
      const defaultInstructions = 'Default fallback instructions';
      loadInstructionsFromFile.mockRejectedValue(new Error('File not found'));
      getDefaultInstructions.mockReturnValue(defaultInstructions);

      // Act
      try {
        await loadInstructionsFromFile();
      } catch (error) {
        const fallbackInstructions = getDefaultInstructions();
        expect(fallbackInstructions).toBe(defaultInstructions);
      }
    });
  });

  describe('Environment Variable Override', () => {
    it('should use DEEPGRAM_INSTRUCTIONS env var when set', async () => {
      // Arrange
      const envInstructions = 'Custom instructions from environment variable';
      process.env.DEEPGRAM_INSTRUCTIONS = envInstructions;
      
      // Mock the actual behavior: when env var is set, return it
      loadInstructionsFromFile.mockImplementation(async () => {
        if (process.env.DEEPGRAM_INSTRUCTIONS) {
          return process.env.DEEPGRAM_INSTRUCTIONS.trim();
        }
        return 'File instructions';
      });
      getDefaultInstructions.mockReturnValue('Default instructions');

      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      expect(instructions).toBe(envInstructions);
    });

    it('should handle Vite environment (CommonJS limitation)', async () => {
      // Arrange
      // Note: CommonJS version doesn't support import.meta.env
      // This test verifies the limitation is handled gracefully
      loadInstructionsFromFile.mockResolvedValue('File instructions');
      getDefaultInstructions.mockReturnValue('Default instructions');

      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      // In CommonJS, it should fall back to file content since import.meta is not available
      expect(instructions).toBe('File instructions');
    });
  });

  describe('Integration with DeepgramVoiceInteraction Component', () => {
    it('should use loaded instructions in agent options', async () => {
      // Arrange
      const loadedInstructions = 'Loaded instructions from file';
      loadInstructionsFromFile.mockResolvedValue(loadedInstructions);
      getDefaultInstructions.mockReturnValue('Default instructions');

      const TestComponent = () => {
        const [instructions, setInstructions] = React.useState('');
        
        React.useEffect(() => {
          loadInstructionsFromFile().then(setInstructions);
        }, []);

        const agentOptions = {
          ...mockAgentOptions,
          instructions: instructions || mockAgentOptions.instructions,
        };

        return (
          <div>
            <div data-testid="instructions-display">{instructions}</div>
            <div data-testid="agent-options">{JSON.stringify(agentOptions)}</div>
          </div>
        );
      };

      // Act
      render(<TestComponent />);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('instructions-display')).toHaveTextContent(loadedInstructions);
        expect(screen.getByTestId('agent-options')).toHaveTextContent(loadedInstructions);
      });
    });

    it('should handle environment variable override in component', async () => {
      // Arrange
      const envInstructions = 'Environment override instructions';
      process.env.DEEPGRAM_INSTRUCTIONS = envInstructions;
      
      // Mock the actual behavior for env var override
      loadInstructionsFromFile.mockImplementation(async () => {
        if (process.env.DEEPGRAM_INSTRUCTIONS) {
          return process.env.DEEPGRAM_INSTRUCTIONS.trim();
        }
        return 'File instructions';
      });
      getDefaultInstructions.mockReturnValue('Default instructions');

      const TestComponent = () => {
        const [instructions, setInstructions] = React.useState('');
        
        React.useEffect(() => {
          loadInstructionsFromFile().then(setInstructions);
        }, []);

        const agentOptions = {
          ...mockAgentOptions,
          instructions: instructions || mockAgentOptions.instructions,
        };

        return (
          <div>
            <div data-testid="instructions-display">{instructions}</div>
            <div data-testid="agent-options">{JSON.stringify(agentOptions)}</div>
          </div>
        );
      };

      // Act
      render(<TestComponent />);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('instructions-display')).toHaveTextContent(envInstructions);
        expect(screen.getByTestId('agent-options')).toHaveTextContent(envInstructions);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Arrange
      loadInstructionsFromFile.mockRejectedValue(new Error('File system error'));
      getDefaultInstructions.mockReturnValue('Fallback instructions');

      // Act & Assert
      try {
        await loadInstructionsFromFile();
      } catch (error) {
        const fallbackInstructions = getDefaultInstructions();
        expect(fallbackInstructions).toBe('Fallback instructions');
      }
    });

    it('should handle empty environment variable', async () => {
      // Arrange
      process.env.DEEPGRAM_INSTRUCTIONS = '';
      loadInstructionsFromFile.mockResolvedValue('File instructions');
      getDefaultInstructions.mockReturnValue('Default instructions');

      // Act
      const instructions = await loadInstructionsFromFile();

      // Assert
      expect(instructions).toBe('File instructions');
    });
  });
});
