# Issue #399 Follow-Up: Customer Still Seeing SETTINGS_ALREADY_APPLIED

**Context:** The customer reports that the SETTINGS_ALREADY_APPLIED bug was not resolved by the v0.7.15 fix. This doc summarizes what was fixed, what might still cause the issue, and how to verify.

---

## What We Fixed (v0.7.15)

1. **No re-send when `agentOptions` changes**  
   After the first Settings has been sent for a connection, we no longer re-send Settings when the parent passes a new `agentOptions` reference (e.g. on mic toggle or re-render). The agentOptions useEffect skips the send and only logs in debug.

2. **Race hardening (follow-up)**  
   In `sendAgentSettings`, we now set `hasSentSettingsRef` and `globalSettingsSent` **before** calling `sendJSON`, and reset them only if `sendJSON` returns false. That prevents a second connection-state callback (e.g. duplicate `connected` events) from sending Settings in the same tick.

---

## What Could Still Cause SETTINGS_ALREADY_APPLIED

### 1. Duplicate Settings from the backend proxy

The customer uses a **backend proxy** (browser → proxy → Deepgram). The duplicate Settings message might not be from our component:

- **Proxy sends its own Settings** when it establishes the upstream connection to Deepgram, and also forwards the client’s Settings → Deepgram sees two Settings.
- **Proxy forwards the client’s Settings twice** (e.g. buffering/replay, or two code paths that both forward the same message).
- **Proxy reconnects** on first audio or mic enable and sends Settings again on the new connection while the server still considers the session the same.

**Action for customer:** Inspect proxy code and logs to see whether it sends or forwards a Settings message more than once per session. Ensure the proxy forwards the client’s Settings exactly once after the upstream connection is ready, and does not send its own Settings unless intended.

### 2. Server or session behavior

- **Server closes on SETTINGS_ALREADY_APPLIED**  
  Even if the client sends Settings only once, the server might close the connection when it responds with SETTINGS_ALREADY_APPLIED (e.g. due to server-side duplicate detection). Our component already treats SETTINGS_ALREADY_APPLIED as non-fatal and does not call `handleError`; the closure may be initiated by the **server** or by the **proxy** when it receives/forwards the error.

- **Session identity**  
  If the proxy or server reuses the same session when the client reconnects (e.g. after a brief disconnect), a second Settings from the “new” connection could be treated as a duplicate for that session.

### 3. Double connection-state or StrictMode (mitigated by hardening)

- **Duplicate `connected` events**  
  If the WebSocket or proxy emits `state: 'connected'` more than once, we used to have a theoretical race where two scheduled `checkAndSend` callbacks could both pass the “!hasSentSettingsRef” check. Setting the flags **before** `sendJSON` removes that race so only the first call actually sends.

- **StrictMode remount**  
  On unmount we reset `globalSettingsSent` in the connection-close handler. A remount (e.g. StrictMode) can therefore see `globalSettingsSent === false` and send Settings again. If the proxy keeps one upstream connection for both “sessions”, the server could see two Settings. The “set flags before send” change does not fix this; it would require not resetting the global flag on close (and possibly a session/connection id) or changing proxy behavior.

---

## How to Verify Where the Duplicate Comes From

### In the browser (our component)

1. **Enable debug**  
   Use `debug={true}` on the Deepgram component.

2. **Check logs**  
   - Look for `🔧 [sendAgentSettings] Called` and `🔧 [Connection State] WebSocket is OPEN, sending Settings`.  
   - If these appear **once** per connection, our component is only sending one Settings; the duplicate is likely from the proxy or server.  
   - If they appear **twice** (e.g. around mic enable or first audio), note what user action or event precedes the second send (e.g. second `connected` event, remount, etc.).

3. **Optional: inspect `__DEEPGRAM_WS_SETTINGS_PAYLOAD__`**  
   The component sets `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__` when it sends Settings. In the console, check how many times this is set per connection and at what times (e.g. before/after mic click).

### In the proxy

1. Log every message **sent to Deepgram** (or every “Settings” message). Confirm whether one or two Settings messages are sent to the upstream per client connection/session.
2. Confirm whether the proxy ever sends its own Settings to Deepgram (e.g. on connect) in addition to forwarding the client’s Settings.
3. If the proxy manages reconnects, confirm whether it sends Settings again on reconnect and whether the server treats that as the same session.

---

## Summary Table

| Possible source of duplicate Settings | Addressed in v0.7.15? | Suggested next step |
|--------------------------------------|------------------------|----------------------|
| Component re-sends when `agentOptions` changes (e.g. mic toggle) | Yes | None |
| Two connection-state callbacks both sending (race) | Yes (flags set before send) | None |
| Proxy sends or forwards Settings twice | No (outside component) | Inspect proxy logic and logs |
| Server closes on SETTINGS_ALREADY_APPLIED | No (server/proxy behavior) | Ask Deepgram if server can keep connection open; ensure proxy doesn’t close client on this error |
| StrictMode remount → new component sends again after close reset | Partially (global reset on close) | If repro is StrictMode-only, consider not resetting global on close or using a session id |

---

## Regression testing (2025-02-04)

Jest regression for Issue #399 was run and passed:

- **Suites:** 10 (e.g. settings-sent-once-issue399, closure-issue-fix, agent-options-useeffect-must-run, agent-options-useeffect-dependency, agent-options-timing, agent-options-resend-*, agent-manager-timing-investigation, listen-model-conditional)
- **Tests:** 39 passed

Command: `npm test -- --testPathPattern="settings-sent-once-issue399|closure-issue-fix|agent-options-useeffect-must-run|agent-options-useeffect-dependency|agent-options-timing|agent-options-resend|agent-manager-timing|listen-model-conditional"`

Additional follow-up in component: on Settings send failure, we now log WebSocket state using a fresh `getReadyState()` call (`stateAtFail`) instead of the pre-send `wsState`, avoiding TypeScript narrowing and reflecting state at failure time.

---

## References

- Issue: [#399](https://github.com/Signal-Meaning/dg_react_agent/issues/399)
- Tracking: [docs/issues/ISSUE-399/README.md](./README.md)
- Component: `sendAgentSettings` and connection state handler in `src/components/DeepgramVoiceInteraction/index.tsx`
