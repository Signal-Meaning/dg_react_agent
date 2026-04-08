import { resolveE2eIdleTimeoutMs } from '../src/utils/e2eIdleTimeoutMs';

describe('resolveE2eIdleTimeoutMs', () => {
  it('prefers a positive integer URL param over VITE value', () => {
    expect(resolveE2eIdleTimeoutMs('30000', '1000')).toBe(30000);
  });

  it('uses VITE value when URL param is absent', () => {
    expect(resolveE2eIdleTimeoutMs(null, '1000')).toBe(1000);
  });

  it('returns undefined when neither is a valid positive integer', () => {
    expect(resolveE2eIdleTimeoutMs(null, undefined)).toBeUndefined();
    expect(resolveE2eIdleTimeoutMs('', undefined)).toBeUndefined();
  });

  it('ignores invalid URL param and falls back to VITE', () => {
    expect(resolveE2eIdleTimeoutMs('abc', '5000')).toBe(5000);
    expect(resolveE2eIdleTimeoutMs('-1', '5000')).toBe(5000);
    expect(resolveE2eIdleTimeoutMs('0', '5000')).toBe(5000);
  });

  it('trims URL param whitespace', () => {
    expect(resolveE2eIdleTimeoutMs('  12000  ', '1000')).toBe(12000);
  });
});
