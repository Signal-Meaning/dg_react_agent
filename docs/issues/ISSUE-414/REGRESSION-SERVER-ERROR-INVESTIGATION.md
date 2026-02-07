# Regression: OpenAI “server had an error” after successful response

**Issue:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)  
**Status:** Investigation pending

---

## Summary

The test-app (and any app using the OpenAI proxy) receives an error from the OpenAI Realtime API **after** a successful turn: *"The server had an error while processing your request..."*. Playback and the turn complete successfully; then the upstream sends an `error` event. This is a **regression** that we should investigate and resolve, not only work around.

---

## Why things “pass” today

We added a **workaround** so the app doesn’t break:

- When the component receives this error and the agent is already **idle** (e.g. just after playback finished), it marks the error as **recoverable** and the host (test-app) shows a **warning** instead of a hard error: *"You can continue or reconnect."*
- So the UI keeps working and tests can pass, but the **underlying problem remains**: the upstream is still sending an error after a successful response.

Treating the error as recoverable **masks** the regression; it does not fix the cause.

---

## What we need to do

1. **Investigate root cause**  
   - Determine why OpenAI sends an `error` event after a successful response when the test-app (or our proxy/component) is the client, while the same proxy works for the CLI (which often exits before the error arrives).  
   - Hypotheses to pursue: message ordering, duplicate or unexpected client events, session/context/greeting handling, or something specific to the browser/WebSocket path.  
   - Ruled out so far: greeting injection (greeting-text-only didn’t remove it), full session payload (minimal-session didn’t remove it).  
   - See community reports, e.g. [OpenAI Realtime – server had an error](https://community.openai.com/t/realtime-api-the-server-had-an-error-while-processing-your-request/978856).

2. **Fix the regression**  
   - Change proxy and/or component behavior so that the upstream no longer sends this error after a successful turn (or document an upstream bug and a proper mitigation).  
   - Re-evaluate the **recoverable** workaround: keep it only as a safety net for genuine post-response upstream errors, or remove it once the regression is resolved.

3. **Verify**  
   - Reproduce the error in a minimal setup (e.g. test-app + proxy + real API), then confirm it no longer occurs after the fix.  
   - Ensure integration and E2E tests still pass with real APIs.

---

## References

- Main issue: `docs/issues/ISSUE-414/README.md` (section “Server had an error after response”).
- Proxy: `scripts/openai-proxy/server.ts`, `run.ts` (TODOs for greetingTextOnly, minimalSession, first-Settings-only).
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` (recoverable error when idle + “server had an error” message).
- Test-app: `test-app/src/App.tsx` (handleError treats `error.recoverable` as warning).
