/**
 * API Key Validation Utilities
 * 
 * Centralized logic for validating Deepgram API keys.
 * 
 * Note: Deepgram API keys are used as-is (no prefix required).
 * Keys are stored in .env without any prefix, as provided by Deepgram.
 */

/**
 * Validates if an API key is a real Deepgram API key
 * 
 * Deepgram API keys are provided without any prefix.
 * This function validates the key format without requiring a prefix.
 * 
 * @param apiKey - The API key to validate (raw key as provided by Deepgram)
 * @returns true if the API key is valid, false otherwise
 */
export function isValidDeepgramApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  
  const trimmed = apiKey.trim();
  
  // Reject placeholder keys
  if (trimmed === 'your-deepgram-api-key-here') {
    return false;
  }
  
  // Accept test keys
  if (trimmed.startsWith('test')) {
    return true;
  }
  
  // Validate length (Deepgram API keys are typically 40+ characters)
  // Note: We don't require 'dgkey_' prefix as Deepgram doesn't use it
  return trimmed.length >= 40;
}

/**
 * Determines if the app should run in mock mode based on API key
 * @param apiKey - The API key to check
 * @param isTestMode - Whether the app is in test mode
 * @param testApiKey - The test API key scenario (for test mode)
 * @returns true if the app should run in mock mode
 */
export function shouldRunInMockMode(
  apiKey: string | undefined,
  isTestMode: boolean = false,
  testApiKey?: string
): boolean {
  if (isTestMode) {
    // In test mode, check the test API key scenario
    return testApiKey === 'missing' || 
           testApiKey === 'placeholder' || 
           testApiKey === 'test';
  }
  
  // In normal mode, check if the real API key is valid
  return !isValidDeepgramApiKey(apiKey);
}

/**
 * Gets the API key validation error message
 * @param apiKey - The API key that failed validation
 * @returns Error message for the invalid API key
 */
export function getApiKeyErrorMessage(apiKey: string | undefined): string {
  if (!apiKey) {
    return 'API key is required';
  }
  
  if (apiKey === 'your-deepgram-api-key-here') {
    return 'Please replace the placeholder API key with your real Deepgram API key';
  }
  
  if (apiKey.startsWith('test')) {
    return 'Test API keys are not supported in production mode';
  }
  
  if (apiKey.length < 40) {
    return 'API key appears to be too short (should be 40+ characters)';
  }
  
  return 'Invalid API key format';
}
