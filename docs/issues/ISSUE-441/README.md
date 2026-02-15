# Issue #441: voice-agent-backend — merge openai.upstreamOptions (OpenAI Realtime 401 fix)

**Branch:** `davidrmcgee/issue441`  
**GitHub:** [Issue #441](https://github.com/Signal-Meaning/dg_react_agent/issues/441)

---

## Summary

`attachVoiceAgentUpgrade(server, { openai: { path, proxyUrl, upstreamOptions } })` ignores the caller's `openai.upstreamOptions`. The package overwrites it with `{ rejectUnauthorized: false }` when using HTTPS (or `{}` otherwise), so integrators cannot pass options to the upstream WebSocket—in particular an `Authorization: Bearer <key>` header required by the OpenAI Realtime API. Without that header, the upstream connection fails with **401 Unauthorized**.

This motivates a release so host apps (e.g. Voice-commerce) can authenticate to the OpenAI Realtime API without patching `node_modules`.

**Source:** Voice-commerce handoff (Issue #901), 2025-02-14. Related component issue: #439.

---

## Current behavior

In `packages/voice-agent-backend/src/attach-upgrade.js` (lines 231–236):

```js
if (openaiOpts?.path && openaiProxyUrl) {
  const upstreamOptions = useHttps ? { rejectUnauthorized: false } : {};
  const { wss } = createOpenAIWss({
    path: openaiOpts.path,
    proxyUrl: openaiProxyUrl,
    upstreamOptions,
    logger: options.logger,
  });
  wssOpenAI = wss;
}
```

`openaiOpts.upstreamOptions` is never read. Caller cannot supply:

- `headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }`
- Any other WebSocket client options (e.g. additional headers, protocols)

**Result:** Upstream connection to `wss://api.openai.com/v1/realtime` is unauthenticated and returns 401.

---

## Expected behavior

- Caller may pass `openai.upstreamOptions` (e.g. `headers` for Authorization).
- Package **merges** caller options with the package’s default options (e.g. `rejectUnauthorized: false` when `useHttps`), so that:
  - Defaults are applied for TLS when needed.
  - Caller can add headers and, if needed, override defaults.

---

## Acceptance criteria

- [x] `attachVoiceAgentUpgrade` passes a **merged** `upstreamOptions` (package defaults + `openai.upstreamOptions`) into `createOpenAIWss`.
- [x] Integrators can pass `openai.upstreamOptions` (e.g. `headers`) and the upstream WebSocket is created with those options.
- [x] Existing behavior when `openai.upstreamOptions` is omitted is unchanged (TLS defaults still applied when `useHttps`).
- [x] Document `openai.upstreamOptions` in the package README / JSDoc (e.g. “merged with package defaults; use for Authorization header for OpenAI Realtime”).
- [x] Backend package version bumped to 0.1.2; release cut so host apps can consume the fix without patching.

---

## References

- [TDD-PLAN.md](./TDD-PLAN.md) — RED/GREEN/REFACTOR plan
- Implementation: `packages/voice-agent-backend/src/attach-upgrade.js` (lines 231–239)
- `createOpenAIWss` already accepts and uses `upstreamOptions`; only the call site in `attachVoiceAgentUpgrade` needs to merge
- Component/transcription issue: [#439](https://github.com/Signal-Meaning/dg_react_agent/issues/439)
- Voice-commerce handoff: Issue #901
