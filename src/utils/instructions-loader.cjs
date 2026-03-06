const DEFAULT_INSTRUCTIONS = 'You are a helpful voice assistant. Keep your responses concise and informative.';

function getDefaultInstructions() {
  return DEFAULT_INSTRUCTIONS;
}

function getEnvironmentInstructions() {
  if (typeof process !== 'undefined' && process.env?.DEFAULT_INSTRUCTIONS) {
    return process.env.DEFAULT_INSTRUCTIONS.trim();
  }
  return null;
}

async function loadInstructionsFromFile() {
  const envInstructions = getEnvironmentInstructions();
  if (envInstructions) {
    return envInstructions;
  }
  return getDefaultInstructions();
}

function loadInstructionsFromFileSync() {
  const envInstructions = getEnvironmentInstructions();
  if (envInstructions) {
    return envInstructions;
  }
  return getDefaultInstructions();
}

module.exports = {
  DEFAULT_INSTRUCTIONS,
  getDefaultInstructions,
  loadInstructionsFromFile,
  loadInstructionsFromFileSync
};
