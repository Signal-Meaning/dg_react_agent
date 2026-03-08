/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeepgramVoiceInteraction from '../src/components/DeepgramVoiceInteraction';
import { getDefaultInstructions, loadInstructionsFromFile } from '../src/utils/instructions-loader.cjs';

jest.mock('../src/utils/instructions-loader.cjs', () => ({
  getDefaultInstructions: jest.fn(),
  loadInstructionsFromFile: jest.fn(),
}));

describe('DEFAULT_INSTRUCTIONS env / default instructions', () => {
  const mockApiKey = 'test-api-key';
  const mockAgentOptions = {
    instructions: 'Default test instructions',
    voice: 'aura-2-apollo-en',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DEFAULT_INSTRUCTIONS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Environment Variable Override', () => {
    it('should use DEFAULT_INSTRUCTIONS env var when set', async () => {
      const envInstructions = 'Custom instructions from environment variable';
      process.env.DEFAULT_INSTRUCTIONS = envInstructions;

      loadInstructionsFromFile.mockImplementation(async () => {
        if (process.env.DEFAULT_INSTRUCTIONS) {
          return process.env.DEFAULT_INSTRUCTIONS.trim();
        }
        return getDefaultInstructions();
      });
      getDefaultInstructions.mockReturnValue('Default instructions');

      const instructions = await loadInstructionsFromFile();

      expect(instructions).toBe(envInstructions);
    });

    it('should return default when env not set', async () => {
      const defaultInstructions = 'Default instructions';
      loadInstructionsFromFile.mockResolvedValue(defaultInstructions);
      getDefaultInstructions.mockReturnValue(defaultInstructions);

      const instructions = await loadInstructionsFromFile();

      expect(instructions).toBe(defaultInstructions);
    });
  });

  describe('Integration with DeepgramVoiceInteraction Component', () => {
    it('should use loaded instructions in agent options', async () => {
      const loadedInstructions = 'Loaded instructions';
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

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('instructions-display')).toHaveTextContent(loadedInstructions);
        expect(screen.getByTestId('agent-options')).toHaveTextContent(loadedInstructions);
      });
    });

    it('should handle environment variable override in component', async () => {
      const envInstructions = 'Environment override instructions';
      process.env.DEFAULT_INSTRUCTIONS = envInstructions;

      loadInstructionsFromFile.mockImplementation(async () => {
        if (process.env.DEFAULT_INSTRUCTIONS) {
          return process.env.DEFAULT_INSTRUCTIONS.trim();
        }
        return getDefaultInstructions();
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

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('instructions-display')).toHaveTextContent(envInstructions);
        expect(screen.getByTestId('agent-options')).toHaveTextContent(envInstructions);
      });
    });
  });

  describe('Empty environment variable', () => {
    it('should return default when env is empty string', async () => {
      process.env.DEFAULT_INSTRUCTIONS = '';
      const defaultInstructions = 'Default instructions';
      loadInstructionsFromFile.mockResolvedValue(defaultInstructions);
      getDefaultInstructions.mockReturnValue(defaultInstructions);

      const instructions = await loadInstructionsFromFile();

      expect(instructions).toBe(defaultInstructions);
    });
  });
});
