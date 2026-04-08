/**
 * Resolve agent idle timeout for the test app when Playwright sets a short global
 * `VITE_IDLE_TIMEOUT_MS` (e.g. 1000ms for greeting-idle specs). E2E specs that need a
 * longer window (e.g. Live + injected audio) can pass `e2eIdleTimeoutMs` in the URL;
 * that value overrides the Vite env when it is a positive integer string.
 */
export function resolveE2eIdleTimeoutMs(
  urlParam: string | null,
  viteIdleTimeoutMs: string | undefined
): number | undefined {
  const trimmed = urlParam?.trim();
  if (trimmed && /^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (viteIdleTimeoutMs != null && viteIdleTimeoutMs !== '') {
    const n = Number(viteIdleTimeoutMs);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
