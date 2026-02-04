# Issue #399: SETTINGS_ALREADY_APPLIED — connection closes after second Settings send (proxy mode)

**Branch:** `davidrmcgee/issue399`  
**GitHub:** [Issue #399](https://github.com/Signal-Meaning/dg_react_agent/issues/399)

---

## Summary

In proxy mode with functions configured, the server responds with **`SETTINGS_ALREADY_APPLIED`** shortly after the first Settings message is successfully applied. The connection then **closes** (transcription and agent both go to `closed`). Any audio or messages sent after that point are sent on a closed connection and never processed.

**Observed trigger:** The duplicate Settings send (or server response) happens **around the time the user enables the microphone or the first audio chunk is sent**, not when adding a new message to context.

**Impact:** Flows that connect → apply Settings → then enable mic or send first audio see the connection close. E2E tests that send audio twice (e.g. before/after page reload) fail because the second connection closes with SETTINGS_ALREADY_APPLIED before the second audio produces any transcript.

---

## Status (track to conclusion)

| Item | Status |
|------|--------|
| **Root cause identified** | [x] |
| **SDK fix: send Settings only once per connection** | [x] |
| **Tests added/updated** | [x] |
| **E2E passes (no SETTINGS_ALREADY_APPLIED on mic/first audio)** | [ ] (verify in CI / real API) |
| **Issue closed** | [ ] |

---

## Investigation notes

- **Component behavior:** In this repo, `SETTINGS_ALREADY_APPLIED` is already handled as non-fatal (`index.tsx` ~2454–2461): we set flags and return without calling `handleError`. So the **component does not close the connection**; closure is likely initiated by the **server** (Deepgram) or the **backend proxy** when the error is received/forwarded.
- **Likely cause of duplicate Settings:** The `agentOptions` useEffect (~1207–1410) resets `hasSentSettingsRef` and `globalSettingsSent` and re-sends Settings when `agentOptions` is considered changed. If the parent re-renders (e.g. on mic toggle) and passes a **new `agentOptions` object reference** (even with same content), the effect can treat it as a change and call `sendAgentSettings()` again.
- **Suggested SDK fix:** Ensure Settings are sent **only once** per WebSocket connection. Guard any path that can run on mic enable or first audio so it does not send Settings when they have already been sent for this connection (e.g. do not reset `hasSentSettingsRef` / `globalSettingsSent` for “agentOptions changed” when the change is only reference identity and content is equivalent, or avoid re-send when Settings were already applied for this connection).

---

## Deliverables (checklist)

### SDK / component

- [x] Ensure for a given WebSocket connection, Settings are sent only once (after connect, before any audio).
- [x] Do not re-send Settings when the user enables the microphone or when the first audio chunk is sent.
- [x] **Done:** Re-send on `agentOptions` change is disabled (Issue #399). When `agentOptions` changes after Settings have been sent for this connection, we skip re-send and log in debug mode. See `src/components/DeepgramVoiceInteraction/index.tsx` (agentOptions useEffect).

### Verification

- [x] Unit test added: `tests/settings-sent-once-issue399.test.tsx` — (1) connect, (2) send Settings and apply, (3) change agentOptions (rerender), (4) assert only one Settings message sent (no re-send).
- [ ] Run E2E that sends audio twice (e.g. transcript capture / component re-renders); test should get past the second connection (no “user-message not found” due to closed connection).

### Upstream / documentation (optional)

- **Server/API:** If the server receives a second Settings message for the same session, respond with `SETTINGS_ALREADY_APPLIED` **without closing** the connection (so client can continue).
- **Docs:** Document that Settings must be sent only once per connection; document whether the server closes on `SETTINGS_ALREADY_APPLIED`.

---

## References

- **GitHub issue:** [Issue #399](https://github.com/Signal-Meaning/dg_react_agent/issues/399)
- **Component:** `src/components/DeepgramVoiceInteraction/index.tsx` — `sendAgentSettings`, `hasSentSettingsRef`, `globalSettingsSent`, agentOptions useEffect, Error handler for `SETTINGS_ALREADY_APPLIED`
- **Option comparison:** `src/utils/option-comparison.ts` — `compareAgentOptionsIgnoringContext`, `hasDependencyChanged`

---

## Conclusion

- **Resolution:** SDK no longer re-sends Settings when `agentOptions` changes after the first Settings has been sent for that connection. The agentOptions useEffect still runs and updates `agentOptionsRef.current`, but it no longer resets `hasSentSettingsRef` / `globalSettingsSent` or calls `sendAgentSettings()`. This avoids the server responding with `SETTINGS_ALREADY_APPLIED` and closing the connection.
- **Branch:** `davidrmcgee/issue399`
- **PR:** (to be opened)
- **Release:** (after merge)
