/**
 * OpenAI proxy client JSON protocol (Issue #533 refactor)
 *
 * Single source of truth for legal component → proxy client `type` values (importable by tests, docs tooling).
 */

import {
  OPENAI_PROXY_CLIENT_JSON_TYPE,
  OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES,
  OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME,
  getOpenAIProxyAllowedClientJsonTypesDescription,
  isLegalOpenAIProxyClientJsonType,
} from '../packages/voice-agent-backend/scripts/openai-proxy/client-protocol';

describe('openai-proxy client-protocol (Issue #533)', () => {
  it('exports stable string constants for each legal client JSON type', () => {
    expect(OPENAI_PROXY_CLIENT_JSON_TYPE.Settings).toBe('Settings');
    expect(OPENAI_PROXY_CLIENT_JSON_TYPE.InjectUserMessage).toBe('InjectUserMessage');
    expect(OPENAI_PROXY_CLIENT_JSON_TYPE.FunctionCallResponse).toBe('FunctionCallResponse');
    expect(OPENAI_PROXY_CLIENT_JSON_TYPE.KeepAlive).toBe('KeepAlive');
  });

  it('OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES lists every accepted type once (strict mode, no Error)', () => {
    expect(OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES).toEqual([
      'Settings',
      'InjectUserMessage',
      'FunctionCallResponse',
      'KeepAlive',
    ]);
    expect(new Set(OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES).size).toBe(4);
  });

  it('OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME is legal types except KeepAlive (no-op at proxy)', () => {
    expect(OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME).toEqual([
      'Settings',
      'InjectUserMessage',
      'FunctionCallResponse',
    ]);
    for (const t of OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME) {
      expect(OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES).toContain(t);
    }
    expect(OPENAI_PROXY_CLIENT_JSON_TYPES_TRANSLATED_TO_REALTIME).not.toContain('KeepAlive');
  });

  describe('isLegalOpenAIProxyClientJsonType', () => {
    it('returns true for each legal type', () => {
      for (const t of OPENAI_PROXY_LEGAL_CLIENT_JSON_TYPES) {
        expect(isLegalOpenAIProxyClientJsonType(t)).toBe(true);
      }
    });

    it('returns false for unknown or empty type', () => {
      expect(isLegalOpenAIProxyClientJsonType('CustomPassthroughDevProbe')).toBe(false);
      expect(isLegalOpenAIProxyClientJsonType(undefined)).toBe(false);
      expect(isLegalOpenAIProxyClientJsonType('')).toBe(false);
    });
  });

  it('getOpenAIProxyAllowedClientJsonTypesDescription matches proxy Error copy (no trailing space)', () => {
    expect(getOpenAIProxyAllowedClientJsonTypesDescription()).toBe(
      'Settings, InjectUserMessage, FunctionCallResponse. KeepAlive is ignored.',
    );
  });
});
