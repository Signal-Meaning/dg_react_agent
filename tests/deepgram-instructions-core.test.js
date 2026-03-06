/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

const { getDefaultInstructions, loadInstructionsFromFile } = require('../src/utils/instructions-loader.cjs');

describe('DEFAULT_INSTRUCTIONS env / default instructions - core functionality', () => {
  beforeEach(() => {
    delete process.env.DEFAULT_INSTRUCTIONS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Environment Variable Override', () => {
    it('should use DEFAULT_INSTRUCTIONS env var when set', async () => {
      const envInstructions = 'Custom instructions from environment variable';
      process.env.DEFAULT_INSTRUCTIONS = envInstructions;

      const instructions = await loadInstructionsFromFile();

      expect(instructions).toBe(envInstructions);
    });

    it('should handle empty environment variable', async () => {
      process.env.DEFAULT_INSTRUCTIONS = '';

      const instructions = await loadInstructionsFromFile();

      expect(instructions).toBe(getDefaultInstructions());
    });
  });

  describe('Default Instructions', () => {
    it('should return default instructions', () => {
      const defaultInstructions = getDefaultInstructions();

      expect(defaultInstructions).toBe('You are a helpful voice assistant. Keep your responses concise and informative.');
    });

    it('should return default when env not set', async () => {
      const instructions = await loadInstructionsFromFile();

      expect(instructions).toBe(getDefaultInstructions());
    });
  });
});
