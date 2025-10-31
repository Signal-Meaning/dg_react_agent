/**
 * Server API Baseline Fixtures
 * 
 * Stable fixtures for testing Deepgram Voice Agent v1 server events.
 * Source: github.com/deepgram/deepgram-api-specs
 */

import { OFFICIAL_DEEPGRAM_SERVER_EVENTS } from '../api-baseline/official-deepgram-api';
import { APPROVED_SERVER_EVENT_ADDITIONS } from '../api-baseline/approved-server-events';

/**
 * Complete list of approved server events
 */
export const APPROVED_SERVER_EVENTS = [
  ...OFFICIAL_DEEPGRAM_SERVER_EVENTS,
  ...Object.keys(APPROVED_SERVER_EVENT_ADDITIONS),
] as const;

/**
 * Check if an event is approved
 */
export function isApprovedEvent(eventName: string): boolean {
  return APPROVED_SERVER_EVENTS.includes(eventName as any);
}

/**
 * Check if an event is in official spec
 */
export function isOfficialEvent(eventName: string): boolean {
  return OFFICIAL_DEEPGRAM_SERVER_EVENTS.includes(eventName as any);
}

/**
 * Check if event needs justification
 */
export function isApprovedAddition(eventName: string): boolean {
  return eventName in APPROVED_SERVER_EVENT_ADDITIONS;
}

