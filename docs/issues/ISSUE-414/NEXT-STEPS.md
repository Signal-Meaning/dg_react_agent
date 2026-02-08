# Issue #414: Next steps

**Branch:** `davidrmcgee/issue414`  
**Issue:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)

---

## Summary

Acceptance criteria for #414 are **done** (CLI text-in, playback + text, docs). Remaining work is **optional hardening** and **investigating the upstream “server had an error” regression**.

---

## 1. Server error regression (priority)

**Ref:** [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md)

- **Observed:** Upstream sends *"The server had an error while processing your request"* after a successful turn (~5s after connection). UI workaround (recoverable + warning) is in place; **tests are written to fail** when the error occurs.
- **Ruled out:** Session.update audio/turn_detection config (four TDD cycles); greeting/session payload variations.
- **Next:**
  1. **Idle timeout:** Check whether server VAD `idle_timeout_ms` (and default ~5–6s) is the cause; try overriding it in `session.audio.input.turn_detection` and re-test with real API.
  2. **Protocol and ordering:** ✅ **Done.** See [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) — client/server events, text vs binary frame rules, and ordering are documented. Use it to confirm we don’t violate Realtime API expectations.
  3. **Upstream/community:** Gather more evidence from OpenAI community (e.g. [server error thread](https://community.openai.com/t/openai-realtime-api-server-error/1373435)); decide if this is a known upstream bug and document or mitigate.
  4. **Fix or document:** Once root cause is known, either fix proxy/component so the error no longer occurs or document upstream behavior and adjust tests/assertions accordingly. Do not suppress forwarding of errors.

---

## 2. Optional: E2E and real-API stability

- **Real-API runs:** Integration and E2E can fail when the upstream error arrives within the wait window (5s integration, 3s E2E). Passing with real APIs means “no error in window,” not “defect fixed.”
- **Next:** After addressing the server error (above), re-run full suite with real APIs and consider tightening or relaxing `assertNoRecoverableAgentErrors` / integration `done()` timing as appropriate.

---

## 3. Optional: Playback and diagnostics

**Ref:** [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md)

- **Current state:** Playback path is fixed (JSON-vs-binary routing, 24k context, double-connect fix, greeting path with `response.create` after item.added). E2E includes first-binary-not-JSON assertion and (where applicable) audio-quality heuristic.
- **Optional next:** If new playback issues appear, use boundary logging (`OPENAI_PROXY_TTS_BOUNDARY_DEBUG=1`) and E2E chunk-boundary diagnostics to compare proxy vs browser; keep integration “only PCM as binary” contract test green.

---

## 4. Doc and code references

- **Main status:** [README.md](./README.md)
- **Protocol and message ordering:** [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)
- **Protocol test gaps:** [PROTOCOL-TEST-GAPS.md](./PROTOCOL-TEST-GAPS.md) — missing unit/integration tests to prove protocol requirements
- **Audio investigation:** [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md)
- **Server error investigation:** [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md)
- **Proxy:** `scripts/openai-proxy/` (server, translator, CLI)
- **Tests:** `tests/integration/openai-proxy-integration.test.ts`, `test-app/tests/e2e/` (OpenAI proxy specs)
