/**
 * Echo Cancellation Detection Utility
 * 
 * Issue: #243 - Enhanced Echo Cancellation Support and Browser Compatibility
 * 
 * Detects and verifies browser support for echo cancellation.
 * Uses MediaTrackSettings API to verify echo cancellation is actually active.
 */

export interface EchoCancellationSupport {
  supported: boolean;
  active: boolean;
  browser: string;
  version?: string;
  limitations?: string[];
}

/**
 * Utility class for detecting echo cancellation support and status
 */
export class EchoCancellationDetector {
  /**
   * Detects echo cancellation support for a given MediaStream
   * @param stream - The MediaStream to check
   * @returns Promise resolving to EchoCancellationSupport information
   */
  static async detectSupport(stream: MediaStream): Promise<EchoCancellationSupport> {
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
      return {
        supported: false,
        active: false,
        browser: this.getBrowserInfo().browser,
        version: this.getBrowserInfo().version,
        limitations: ['No audio tracks found in stream'],
      };
    }

    // Get the first audio track
    const audioTrack = audioTracks[0];
    
    // Check if browser supports echo cancellation constraint
    const supportedConstraints = this.getSupportedConstraints();
    const supported = supportedConstraints.echoCancellation === true;

    // Get actual settings to verify echo cancellation is active
    let active = false;
    try {
      const settings = audioTrack.getSettings();
      active = settings.echoCancellation === true;
    } catch (error) {
      // getSettings might not be available or might throw
      // In this case, we can't verify if it's active
    }

    // Get browser info
    const browserInfo = this.getBrowserInfo();

    // Determine limitations
    const limitations: string[] = [];
    if (!supported) {
      limitations.push('Browser does not support echoCancellation constraint');
    }
    if (supported && !active) {
      limitations.push('Echo cancellation requested but not active (may be disabled by browser or system)');
    }

    return {
      supported,
      active,
      browser: browserInfo.browser,
      version: browserInfo.version,
      limitations: limitations.length > 0 ? limitations : undefined,
    };
  }

  /**
   * Verifies if echo cancellation is currently active on a MediaStream
   * @param stream - The MediaStream to check
   * @returns Promise resolving to boolean indicating if echo cancellation is active
   */
  static async verifyActive(stream: MediaStream): Promise<boolean> {
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
      return false;
    }

    try {
      const settings = audioTracks[0].getSettings();
      return settings.echoCancellation === true;
    } catch (error) {
      // If getSettings fails, we can't verify
      return false;
    }
  }

  /**
   * Gets browser name and version from user agent
   * @returns Object with browser name and optional version
   */
  static getBrowserInfo(): { browser: string; version?: string } {
    const userAgent = navigator.userAgent;

    // Chrome detection
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    if (chromeMatch && !userAgent.includes('Edg')) {
      return {
        browser: 'Chrome',
        version: chromeMatch[1],
      };
    }

    // Edge detection (must come after Chrome since Edge contains "Chrome")
    const edgeMatch = userAgent.match(/Edg\/(\d+)/);
    if (edgeMatch) {
      return {
        browser: 'Edge',
        version: edgeMatch[1],
      };
    }

    // Firefox detection
    const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
    if (firefoxMatch) {
      return {
        browser: 'Firefox',
        version: firefoxMatch[1],
      };
    }

    // Safari detection (must come after Chrome since Safari contains "Safari")
    const safariMatch = userAgent.match(/Version\/(\d+)/);
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return {
        browser: 'Safari',
        version: safariMatch ? safariMatch[1] : undefined,
      };
    }

    // Unknown browser
    return {
      browser: 'Unknown',
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
}

