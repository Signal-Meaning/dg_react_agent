# Issue #565 — pre-PR refactor TDD (items 1–5)

**Goal:** Lock behavior before internal cleanup: dedupe test vs implementation hashing, tidy types/JSDoc, DRY SHA-256, extract compact console payload builder.

---

## RED — executable specification (add first)

This step is **specification-first**: new tests encode current behavior and should be **green** on the existing implementation before refactors. Any later refactor that breaks them is **RED** until fixed.

1. Add **`tests/openai-proxy-logger-w3c.test.ts`** (`@jest-environment node`) with **golden vectors** for:
   - **`w3cTraceIdFromCorrelation`**: short id `c1`; UUID with dashes (lower + upper case); edge case where compact 32-hex is `INVALID_TRACEID` (all zeros) so implementation must **hash the original** string.
   - **`w3cSpanIdForProxyCorrelation`**: `c1` plus a second correlation proving different outputs.
2. Run:
   ```bash
   npm test -- tests/openai-proxy-logger-w3c.test.ts
   ```
   Expect **green** once the spec matches `logger.ts`.

---

## GREEN — refactors (keep the new spec green)

3. **`logger.ts`**
   - Private **`sha256Utf8Hex`**, used by both W3C helpers.
   - Extract **`buildCompactConsoleLogPayload(logRecord)`** (module scope, used only by `CompactProxyConsoleLogRecordExporter`).
   - Import **`AttributeValue`** from `@opentelemetry/api` for `emitLog` attribute filtering (drop inline `import('@opentelemetry/api').AttributeValue`).
   - **JSDoc** on **`logRecordExporter`**: honored only on **first** `initProxyLogger` (early return when provider already exists).
4. **`tests/logging-standard-proxy.test.ts`**
   - Remove **`createHash`** and local `expectedW3CTraceFromShortId` / `expectedSpanIdFromCorrelation`.
   - Import **`w3cTraceIdFromCorrelation`** and **`w3cSpanIdForProxyCorrelation`** from `logger.ts` (single source of truth with `openai-proxy-logger-w3c.test.ts`).

---

## REFACTOR — verify

5. Run:
   ```bash
   npm test -- tests/openai-proxy-logger-w3c.test.ts tests/logging-standard-proxy.test.ts tests/packaging/voice-agent-backend-runtime-dependencies.test.ts
   ```
6. Optional: `npm test -- tests/openai-proxy.test.ts` for proxy sanity.

No intended behavior change; if any assertion fails, fix implementation — do not weaken the spec.

---

## Mapping: suggestion list → work

| # | Work |
|---|------|
| 1 | Integration tests use exported W3C helpers (logging-standard-proxy). |
| 2 | `AttributeValue` import cleanup in `emitLog`. |
| 3 | First-init JSDoc on `logRecordExporter` / `initProxyLogger`. |
| 4 | `sha256Utf8Hex` private helper. |
| 5 | `buildCompactConsoleLogPayload` + slim exporter loop. |
