/**
 * API Key Validation Utilities
 * 
 * Centralized logic for validating Deepgram API keys
 * to ensure consistency across the application.
 */

/**
 * Validates if an API key is a real Deepgram API key
 * @param apiKey - The API key to validate
 * @returns true if the API key is valid, false otherwise
 */
export function isValidDeepgramApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  
  return (
    apiKey !== 'your-deepgram-api-key-here' &&
    apiKey.startsWith('dgkey_') &&
    apiKey.length >= 40 // Deepgram API keys are typically 40+ characters
  );
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
  
  if (!apiKey.startsWith('dgkey_')) {
    return 'API key must start with "dgkey_"';
  }
  
  if (apiKey.length < 40) {
    return 'API key appears to be too short (should be 40+ characters)';
  }
  
  return 'Invalid API key format';
}
