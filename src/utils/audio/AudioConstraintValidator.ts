/**
 * Audio Constraint Validator
 * 
 * Issue: #243 - Enhanced Echo Cancellation Support and Browser Compatibility
 * 
 * Validates audio constraints before applying them to getUserMedia.
 * Checks browser support and validates constraint values.
 */

import { AudioConstraints } from '../../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates audio constraints before applying them
 */
export class AudioConstraintValidator {
  /**
   * Validates audio constraints
   * @param constraints - The constraints to validate
   * @returns Validation result with errors and warnings
   */
  static validate(constraints: AudioConstraints): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check browser support for constraints
    const supportedConstraints = this.getSupportedConstraints();

    // Validate echoCancellation
    if (constraints.echoCancellation !== undefined) {
      if (!supportedConstraints.echoCancellation) {
        warnings.push('Browser does not support echoCancellation constraint');
      }
    }

    // Validate noiseSuppression
    if (constraints.noiseSuppression !== undefined) {
      if (!supportedConstraints.noiseSuppression) {
        warnings.push('Browser does not support noiseSuppression constraint');
      }
    }

    // Validate autoGainControl
    if (constraints.autoGainControl !== undefined) {
      if (!supportedConstraints.autoGainControl) {
        warnings.push('Browser does not support autoGainControl constraint');
      }
    }

    // Validate sampleRate
    if (constraints.sampleRate !== undefined) {
      if (!supportedConstraints.sampleRate) {
        warnings.push('Browser does not support sampleRate constraint');
      } else {
        // Validate sampleRate range (typically 8000-48000 Hz)
        if (constraints.sampleRate < 8000 || constraints.sampleRate > 48000) {
          errors.push(`Sample rate ${constraints.sampleRate} is outside valid range (8000-48000 Hz)`);
        }
      }
    }

    // Validate channelCount
    if (constraints.channelCount !== undefined) {
      const hasChannelCount = 'channelCount' in supportedConstraints && supportedConstraints.channelCount === true;
      if (!hasChannelCount) {
        warnings.push('Browser does not support channelCount constraint');
      } else {
        // Validate channelCount (typically 1 or 2)
        if (constraints.channelCount !== 1 && constraints.channelCount !== 2) {
          errors.push(`Channel count ${constraints.channelCount} is invalid (must be 1 or 2)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Gets supported constraints from the browser
   * @returns Object with boolean properties for each supported constraint
   */
  private static getSupportedConstraints(): ReturnType<typeof navigator.mediaDevices.getSupportedConstraints> {
    if (typeof navigator !== 'undefined' && 
        navigator.mediaDevices && 
        typeof navigator.mediaDevices.getSupportedConstraints === 'function') {
      return navigator.mediaDevices.getSupportedConstraints();
    }
    
    // Fallback: return empty object if API not available
    return {} as ReturnType<typeof navigator.mediaDevices.getSupportedConstraints>;
  }

  /**
   * Checks if a specific constraint is supported
   * @param constraintName - Name of the constraint to check
   * @returns true if the constraint is supported
   */
  static isConstraintSupported(constraintName: string): boolean {
    const supported = this.getSupportedConstraints();
    return (supported as Record<string, boolean>)[constraintName] === true;
  }
}

