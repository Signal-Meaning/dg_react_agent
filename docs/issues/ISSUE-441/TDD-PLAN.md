# Issue #441: TDD plan — Merge openai.upstreamOptions for OpenAI Realtime 401 fix

**Parent:** [GitHub Issue #441](https://github.com/Signal-Meaning/dg_react_agent/issues/441) | [README.md](./README.md)

---

## Overview

This document is the **Test-Driven Development** plan for allowing callers to pass `openai.upstreamOptions` (e.g. `Authorization` header) into `attachVoiceAgentUpgrade`. The package will merge caller options with package defaults instead of replacing them. Work follows: **tests first (RED), then minimal implementation (GREEN), then refactor/docs (REFACTOR).**

**Goal:** Integrators can pass `openai.upstreamOptions` so the upstream WebSocket to the OpenAI Realtime API is created with caller-supplied options (e.g. `headers: { Authorization: 'Bearer ' + key }`), while package TLS defaults (e.g. `rejectUnauthorized: false` when HTTPS) are still applied.

---

## Phase 1: Merge upstreamOptions at call site

**Goal:** `attachVoiceAgentUpgrade` passes merged `upstreamOptions` (package defaults + `openai.upstreamOptions`) into `createOpenAIWss`.

### 1.1 RED — Tests: attachVoiceAgentUpgrade merges openai.upstreamOptions

**Location:** `tests/voice-agent-backend-api.test.ts` (or a dedicated test file for attach-upgrade behavior).

1. **Write failing tests** that:
   - When `attachVoiceAgentUpgrade` is called with `openai: { path, proxyUrl, upstreamOptions: { headers: { Authorization: 'Bearer test-key' } } }`, assert that `createOpenAIWss` is invoked with an `upstreamOptions` object that includes `headers.Authorization === 'Bearer test-key'`.
   - When `openai.upstreamOptions` is omitted, assert that `createOpenAIWss` is still called with package defaults only (e.g. `rejectUnauthorized: false` when HTTPS, or `{}` when not).
   - When both HTTPS and caller `upstreamOptions` are used, assert the merged object has both `rejectUnauthorized: false` and the caller’s keys (e.g. `headers`).
2. Run tests → **RED** (current code does not read `openaiOpts.upstreamOptions`).

### 1.2 GREEN — Implement merge in attach-upgrade.js

1. In `packages/voice-agent-backend/src/attach-upgrade.js` (lines 231–236), replace:
   - `const upstreamOptions = useHttps ? { rejectUnauthorized: false } : {};`
   - with:
   - `const baseUpstreamOptions = useHttps ? { rejectUnauthorized: false } : {};`
   - `const upstreamOptions = { ...baseUpstreamOptions, ...(openaiOpts.upstreamOptions || {}) };`
2. Pass the merged `upstreamOptions` into `createOpenAIWss` as today.
3. Run tests → **GREEN**.

### 1.3 REFACTOR

- No structural refactor required; keep the change minimal.
- Ensure JSDoc for `attachVoiceAgentUpgrade` documents `openai.upstreamOptions` (see Phase 2).

**Deliverables:** Caller `openai.upstreamOptions` is merged with package defaults and passed to `createOpenAIWss`; tests pass.

---

## Phase 2: Document openai.upstreamOptions

**Goal:** README and JSDoc document `openai.upstreamOptions` so integrators know they can pass headers (e.g. Authorization for OpenAI Realtime).

### 2.1 README

1. In `packages/voice-agent-backend/README.md`, add or extend the `openai` options section:
   - Document `openai.upstreamOptions`: merged with package defaults; use for WebSocket client options (e.g. `headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }` for OpenAI Realtime API).
2. Optional: one-line note that when using HTTPS, the package still applies `rejectUnauthorized: false` by default unless overridden.

### 2.2 JSDoc

1. In `attach-upgrade.js`, ensure the `@param` for `options.openai` mentions `upstreamOptions`:
   - e.g. `upstreamOptions?: object` — merged with package defaults; use for Authorization header for OpenAI Realtime.

**Deliverables:** README and JSDoc updated; acceptance criteria for documentation satisfied.

---

## Phase 3: Version bump and release

**Goal:** Backend package version bumped and release cut so host apps can consume the fix without patching.

1. Bump version in `packages/voice-agent-backend/package.json` per project versioning policy.
2. Follow project release checklist (changelog, tag, publish if applicable).

**Deliverables:** New backend package version released; host apps (e.g. Voice-commerce) can depend on it for OpenAI Realtime 401 fix.

---

## Proposed code change (reference)

```js
// packages/voice-agent-backend/src/attach-upgrade.js (lines 231–239)

if (openaiOpts?.path && openaiProxyUrl) {
  const baseUpstreamOptions = useHttps ? { rejectUnauthorized: false } : {};
  const upstreamOptions = { ...baseUpstreamOptions, ...(openaiOpts.upstreamOptions || {}) };
  const { wss } = createOpenAIWss({
    path: openaiOpts.path,
    proxyUrl: openaiProxyUrl,
    upstreamOptions,
    logger: options.logger,
  });
  wssOpenAI = wss;
}
```
