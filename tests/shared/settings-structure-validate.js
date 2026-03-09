/**
 * Shared Settings message structure validation (Issue #379).
 * Used by unit tests (component-test-helpers) and E2E (test-helpers.js).
 * Single source of truth for Settings shape; throws on invalid.
 *
 * @param {object} settings - Settings message payload
 * @param {{ requireContext?: boolean, requireFunctions?: boolean }} [options]
 * @throws {Error} When structure is invalid
 */
function validateSettingsStructure(settings, options = {}) {
  if (!settings) {
    throw new Error('Settings message is undefined');
  }
  if (settings.type !== 'Settings') {
    throw new Error(`Expected type "Settings", got "${settings.type}"`);
  }
  if (!settings.agent) {
    throw new Error('Settings.agent is missing');
  }
  if (!settings.agent.think) {
    throw new Error('Settings.agent.think is missing');
  }
  if (
    typeof settings.agent.think.prompt !== 'undefined' &&
    typeof settings.agent.think.prompt !== 'string'
  ) {
    throw new Error('Settings.agent.think.prompt must be a string');
  }
  if (settings.agent.context !== undefined) {
    if (!settings.agent.context || !Array.isArray(settings.agent.context.messages)) {
      throw new Error('When present, Settings.agent.context must have a messages array');
    }
  }
  if (options.requireContext) {
    if (!settings.agent.context || !Array.isArray(settings.agent.context.messages)) {
      throw new Error('Settings.agent.context (with messages) is required');
    }
  }
  if (options.requireFunctions) {
    if (
      !Array.isArray(settings.agent.think.functions) ||
      settings.agent.think.functions.length === 0
    ) {
      throw new Error('Settings.agent.think.functions is required and must be non-empty');
    }
  }
}

module.exports = { validateSettingsStructure };
