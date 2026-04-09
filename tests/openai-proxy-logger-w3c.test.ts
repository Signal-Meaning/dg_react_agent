/**
 * Issue #565 refactor TDD: golden vectors for proxy correlation → W3C trace/span ids.
 * Spec must stay aligned with packages/voice-agent-backend/scripts/openai-proxy/logger.ts.
 *
 * @jest-environment node
 */

import { createHash } from 'crypto';
import {
  w3cTraceIdFromCorrelation,
  w3cSpanIdForProxyCorrelation,
} from '../packages/voice-agent-backend/scripts/openai-proxy/logger';

describe('openai-proxy logger W3C correlation (Issue #565)', () => {
  describe('w3cTraceIdFromCorrelation', () => {
    it('hashes short non-hex correlation to 32 lowercase hex', () => {
      expect(w3cTraceIdFromCorrelation('c1')).toBe(
        createHash('sha256').update('c1', 'utf8').digest('hex').slice(0, 32)
      );
      expect(w3cTraceIdFromCorrelation('c1')).toBe('d0f631ca1ddba8db3bcfcb9e057cdc98');
    });

    it('uses stripped lowercase UUID as trace id when valid W3C trace id', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(w3cTraceIdFromCorrelation(uuid)).toBe('550e8400e29b41d4a716446655440000');
    });

    it('normalizes uppercase UUID to lowercase compact trace id', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000';
      expect(w3cTraceIdFromCorrelation(uuid)).toBe('550e8400e29b41d4a716446655440000');
    });

    it('does not use all-zero compact id (INVALID_TRACEID); hashes full input string', () => {
      const uuid = '00000000-0000-0000-0000-000000000000';
      expect(w3cTraceIdFromCorrelation(uuid)).toBe(
        createHash('sha256').update(uuid, 'utf8').digest('hex').slice(0, 32)
      );
    });
  });

  describe('w3cSpanIdForProxyCorrelation', () => {
    it('derives deterministic 16-hex span id with openai-proxy salt', () => {
      expect(w3cSpanIdForProxyCorrelation('c1')).toBe(
        createHash('sha256').update('openai-proxy|c1', 'utf8').digest('hex').slice(0, 16)
      );
      expect(w3cSpanIdForProxyCorrelation('c1')).toBe('85b1de2ae76720c2');
    });

    it('differs when correlation string differs', () => {
      const a = w3cSpanIdForProxyCorrelation('correlation-id-456');
      const b = w3cSpanIdForProxyCorrelation('correlation-id-457');
      expect(a).toHaveLength(16);
      expect(b).toHaveLength(16);
      expect(a).not.toBe(b);
    });
  });
});
