# Issue #441: TDD plan — Merge openai.upstreamOptions for OpenAI Realtime 401 fix

**Parent:** [GitHub Issue #441](https://github.com/Signal-Meaning/dg_react_agent/issues/441) | [README.md](./README.md)

---

## Overview

This document is the **Test-Driven Development** plan for allowing callers to pass `openai.upstreamOptions` (e.g. `Authorization` header) into `attachVoiceAgentUpgrade`. The package will merge caller options with package defaults instead of replacing them. Work follows: **tests first (RED), then minimal implementation (GREEN), then refactor/docs (REFACTOR).**

**Goal:** Integrators can pass `openai.upstreamOptions` so the upstream WebSocket to the OpenAI Realtime API is created with caller-supplied options (e.g. `headers: { Authorization: 'Bearer ' + key }`), while package TLS defaults (e.g. `rejectUnauthorized: false` when HTTPS) are still applied.

---

## Phase 1: Merge upstreamOptions at call site ✅ DONE

**Goal:** `attachVoiceAgentUpgrade` passes merged `upstreamOptions` (package defaults + `openai.upstreamOptions`) into `createOpenAIWss`.

### 1.1 RED — Tests: attachVoiceAgentUpgrade merges openai.upstreamOptions ✅

**Location:** `tests/voice-agent-backend-attach-upgrade-upstream.test.ts`.

1. **Wrote failing tests** that assert `mergeUpstreamOptions(useHttps, callerOptions)` returns the correct merged object (caller only when not https; package defaults when https and no caller; merged when both).
2. Run tests → **RED** (function did not exist).

### 1.2 GREEN — Implement merge in attach-upgrade.js ✅

1. Added `mergeUpstreamOptions(useHttps, callerOptions)` helper; export it for testing.
2. In `attachVoiceAgentUpgrade`, use `const upstreamOptions = mergeUpstreamOptions(useHttps, openaiOpts.upstreamOptions);` and pass into `createOpenAIWss`.
3. Run tests → **GREEN**.

### 1.3 REFACTOR ✅

- JSDoc for `attachVoiceAgentUpgrade` documents `openai.upstreamOptions` (Phase 2).

**Deliverables:** Caller `openai.upstreamOptions` is merged with package defaults and passed to `createOpenAIWss`; tests pass.

---

## Phase 2: Document openai.upstreamOptions ✅ DONE

**Goal:** README and JSDoc document `openai.upstreamOptions` so integrators know they can pass headers (e.g. Authorization for OpenAI Realtime).

### 2.1 README ✅

1. In `packages/voice-agent-backend/README.md`, extended the **openai** options line to document `openai.upstreamOptions?` — merged with package defaults; use for `headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }` for OpenAI Realtime API (Issue #441).

### 2.2 JSDoc ✅

1. In `attach-upgrade.js`, `@param` for `options.openai` documents `upstreamOptions` — merged with package defaults; use for Authorization header for OpenAI Realtime (Issue #441).

**Deliverables:** README and JSDoc updated; acceptance criteria for documentation satisfied.

---

## Phase 3: Version bump and release ✅ DONE (version bump)

**Goal:** Backend package version bumped and release cut so host apps can consume the fix without patching.

1. Bumped version in `packages/voice-agent-backend/package.json` to **0.1.2**.
2. Follow project release checklist (changelog, tag, publish) when cutting release.

**Deliverables:** Backend package version 0.1.2; host apps can depend on it for OpenAI Realtime 401 fix after release.

---

## Implemented change

Merge is implemented via `mergeUpstreamOptions(useHttps, openaiOpts.upstreamOptions)` and used in `attachVoiceAgentUpgrade`:

```js
// packages/voice-agent-backend/src/attach-upgrade.js

if (openaiOpts?.path && openaiProxyUrl) {
  const upstreamOptions = mergeUpstreamOptions(useHttps, openaiOpts.upstreamOptions);
  const { wss } = createOpenAIWss({
    path: openaiOpts.path,
    proxyUrl: openaiProxyUrl,
    upstreamOptions,
    logger: options.logger,
  });
  wssOpenAI = wss;
}
```
