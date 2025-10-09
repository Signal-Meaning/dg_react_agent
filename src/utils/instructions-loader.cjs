const fs = require('fs');
const path = require('path');

const DEFAULT_INSTRUCTIONS = 'You are a helpful voice assistant. Keep your responses concise and informative.';

function getDefaultInstructions() {
  return DEFAULT_INSTRUCTIONS;
}

function getEnvironmentInstructions() {
  if (typeof process !== 'undefined' && process.env?.DEEPGRAM_INSTRUCTIONS) {
    return process.env.DEEPGRAM_INSTRUCTIONS.trim();
  }
  // Note: import.meta is not available in CommonJS, so we skip Vite env check here
  return null;
}

function getDefaultInstructionsFilePath() {
  // Check if we're in a real browser environment (not Jest with jsdom)
  if (typeof window !== 'undefined' && typeof process === 'undefined') {
    throw new Error('File reading not supported in browser environment');
  }
  const projectRoot = process.cwd();
  return path.join(projectRoot, 'instructions.txt');
}

function readInstructionsFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

async function loadInstructionsFromFile(filePath) {
  try {
    const envInstructions = getEnvironmentInstructions();
    if (envInstructions) {
      return envInstructions;
    }

    const instructionsFilePath = filePath || getDefaultInstructionsFilePath();
    const fileContent = await readInstructionsFile(instructionsFilePath);
    
    if (fileContent && fileContent.trim()) {
      return fileContent.trim();
    }

    return getDefaultInstructions();
  } catch (error) {
    console.warn('Failed to load instructions from file, using default:', error.message);
    return getDefaultInstructions();
  }
}

function loadInstructionsFromFileSync(filePath) {
  try {
    const envInstructions = getEnvironmentInstructions();
    if (envInstructions) {
      return envInstructions;
    }

    const instructionsFilePath = filePath || getDefaultInstructionsFilePath();
    const fileContent = fs.readFileSync(instructionsFilePath, 'utf8');
    
    if (fileContent && fileContent.trim()) {
      return fileContent.trim();
    }

    return getDefaultInstructions();
  } catch (error) {
    console.warn('Failed to load instructions from file, using default:', error);
    return getDefaultInstructions();
  }
}

module.exports = {
  DEFAULT_INSTRUCTIONS,
  getDefaultInstructions,
  loadInstructionsFromFile,
  loadInstructionsFromFileSync
};