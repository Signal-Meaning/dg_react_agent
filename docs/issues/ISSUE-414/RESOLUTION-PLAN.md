# Issue #414: Resolution plan — "server had an error" (5s defect)

**Purpose:** Actionable plan to resolve the upstream "server had an error" defect. Written so a future implementer or reviewer can execute it without re-testing ruled-out paths or misreading progress as resolution.

---

## 1. Headline (read this first)

The **5s "server had an error" defect is unresolved.** Four TDD cycles proved it is not caused by session.update audio/VAD config. The real-API firm audio integration test uses a **12s** assertion window (so we are not racing the ~5s timeout); the error may still persist in E2E. This document is the resolution plan.

---

## 2. What we fixed vs what remains broken

### Fixed (do not re-investigate)

- **Dual-control race** → "buffer too small" and "conversation already has an active response." Addressed by: disable Server VAD (`turn_detection: null`), send format, proxy-only commit + `response.create`, audio gate (no append before session.updated). Protocol and integration tests confirm this. See [CURRENT-UNDERSTANDING.md](./CURRENT-UNDERSTANDING.md) and [RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md](./RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md) for protocol and code locations.

### Remains broken (this plan targets only this)

- The generic **"server had an error"** (and sometimes connection close) — either right after append or ~5s after connection / after a successful turn. This plan targets that defect only.

---

## 3. Differential diagnosis

Use this table so the next person does not re-test ruled-out paths.

| Hypothesis | Tested? | Result / notes |
|------------|---------|----------------|
| Session.update audio/VAD config | Yes (4 TDD cycles) | Ruled out |
| idle_timeout_ms | Yes (experiment run) | With server_vad + idle_timeout_ms 30000 we get "buffer too small" (dual-control race); cannot adopt without re-introducing that error. See §10 progress log. |
| Audio content/quality (silence vs speech) | Yes (one run) | Both variants passed: silence and speech-like (TTS/recorded fixture from tests/fixtures/audio-samples) within 12s, turn_detection: null. Single run; recommend N runs for pass rate. |
| Connection concurrency / race conditions | No | E2E may open multiple connections or reconnect |
| Rate limiting / account-level throttling | No | OpenAI may throttle test accounts |
| Audio chunk size / framing | Partially | 20ms chunks enforced; not varied |
| Upstream bug (no client-side fix) | Assumed fallback | No evidence from OpenAI support yet |

---

## 4. idle_timeout_ms: logical gap and the one experiment

### Logical gap

`idle_timeout_ms` is documented under turn_detection in the [Realtime VAD docs](https://platform.openai.com/docs/guides/realtime-vad). We send `turn_detection: null`, so we explicitly disable Server VAD. If VAD is disabled, an "idle timeout" from VAD may not apply — or the server may still run a separate timeout. The hypothesis is thin until tested.

### Single experiment (first resolution step)

Send **Server VAD with long idle timeout and no auto-response:**

```ts
turn_detection: { type: 'server_vad', idle_timeout_ms: 30000, create_response: false }
```

- **If the 5s error disappears:** points to server-side idle timeout; we can tune or document the working config.
- **If the 5s error persists:** the idle_timeout_ms hypothesis is weakened; proceed to audio content, concurrency, rate limiting, or upstream bug (see §7).

### Implementation note

- **File:** [scripts/openai-proxy/translator.ts](../../../scripts/openai-proxy/translator.ts) — `mapSettingsToSessionUpdate` currently sets `turn_detection: null` (see session.audio.input block).
- Add a small, gated change (e.g. env flag or comment) to send the object form for this experiment; revert or keep based on result.
- The type `OpenAISessionUpdate` already allows a `turn_detection` object (see interface around line 33).

---

## 5. Firm audio test: what it proves and what it doesn’t

### What it proves

With the current protocol, the real-API integration test **"Issue #414 real-API: firm audio connection — no Error from upstream within 12s after sending audio"** (in [tests/integration/openai-proxy-integration.test.ts](../../../tests/integration/openai-proxy-integration.test.ts)) can pass: no Error from upstream within **12 seconds** after sending audio in that scenario. The assertion window is set at **12 seconds** so the test is not racing the ~5s timeout.

### What it doesn’t

1. **Single pass is weak evidence** — Document pass rate across N runs (e.g. 5 or 10) when reporting results.
2. **Flaky upstream** — Passing sometimes and failing in E2E is consistent with flaky upstream behavior, not a resolved defect.

---

## 6. E2E policy (reconcile with critique)

**E2E policy: 0 agent errors.** No relaxation for error count. Content relaxations (Repro 9/10, connect-only chunks >= 0) do not allow errors; they relax response shape or greeting TTS expectations.

- **Current code:** [test-app/tests/e2e/helpers/test-helpers.js](../../../test-app/tests/e2e/helpers/test-helpers.js) — `assertNoRecoverableAgentErrors(page)` has no second argument; all calls require 0 errors.
- **E2E-RELAXATIONS-EXPLAINED.md** states "Allow 1 error" was **UNDONE**.
- **Stale wording:** [NEXT-STEPS.md](./NEXT-STEPS.md) §1 item A still describes "allow up to 1 recoverable error" for test 5 when USE_REAL_APIS=1. That wording is stale and should be corrected in a separate update so it matches current behavior (0 errors).

---

## 7. Ordered resolution steps (actionable)

1. **Run the idle_timeout_ms experiment** (§4). Record result: error gone vs error persists.
2. **If error persists:** **Vary audio content (real speech vs silence) in the integration test** — we found this critical in similar conditions. Run multiple real-API firm audio runs and record pass rate; then consider concurrency, rate limiting, or escalating as upstream bug with evidence.
3. **If error gone:** Document the working config; consider making `idle_timeout_ms` configurable (e.g. in session config or env); update [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md) and [CURRENT-UNDERSTANDING.md](./CURRENT-UNDERSTANDING.md); re-run E2E and firm audio test.
4. **Regardless:** Update [NEXT-STEPS.md](./NEXT-STEPS.md) so test 5 / item A reflects current E2E policy (0 errors). Optionally add a short "Evidence" subsection: firm audio test pass rate over N runs.

---

## 8. Documentation (consolidation)

The 14–16 document constellation for this issue creates high cognitive overhead for reviewers. **Consolidate to at most 3 documents:**

1. **Single status/understanding doc** — Merge or cross-link: CURRENT-UNDERSTANDING.md, README.md, and the status parts of NEXT-STEPS.md and RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md so one place is the entry point.
2. **Investigation log** — REGRESSION-SERVER-ERROR-INVESTIGATION.md as the authoritative 4-cycle log; optionally fold in E2E-RUN-RESULTS, E2E-FAILURE-REVIEW, and other run/result docs.
3. **Protocol spec** — [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) already exists; keep as the single protocol source.

Archive or merge the rest (E2E-RELAXATIONS-EXPLAINED, OPENAI-AUDIO-PLAYBACK-INVESTIGATION, COMPONENT-PROXY-INTERFACE-TDD, etc.) into the above or into an "archive" section.

---

## 9. References (minimal; prefer links over embedded code)

- **Protocol details and code locations:** [RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md](./RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md) — translator, server.ts, PROTOCOL doc. Prefer "see file X at line Y" over pasting code so this plan doesn’t go stale.
- **4 cycles and API/community URLs:** [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md).
- **Two errors and doc index:** [CURRENT-UNDERSTANDING.md](./CURRENT-UNDERSTANDING.md).

---

## 10. Progress log (step-wise updates)

- **Plan updates:** Firm audio assertion window set to **12s** (not 5s). Audio content (real speech vs silence) marked **critical** to vary. Doc consolidation: **definitely** consolidate to 3 docs.
- **Step 1 (idle_timeout_ms experiment):** Done. Implemented in translator: when `OPENAI_REALTIME_IDLE_TIMEOUT_MS` is set, send `turn_detection: { type: 'server_vad', idle_timeout_ms: N, create_response: false }`. Ran real-API firm audio test with `OPENAI_REALTIME_IDLE_TIMEOUT_MS=30000` and `USE_REAL_OPENAI=1`. **Result:** Test failed with **"Error committing input audio buffer: buffer too small. Expected at least 100ms of audio, but buffer only has 0.00ms"** — i.e. with Server VAD enabled (even with `create_response: false`), the server commits or consumes the buffer before our proxy, so we hit the dual-control race again. The generic "server had an error" did not appear in this run because the buffer error occurred first. **Conclusion:** We cannot adopt server_vad + idle_timeout_ms without re-introducing "buffer too small"; keeping `turn_detection: null` for now. Next: vary audio content (real speech vs silence) as critical; then consider upstream bug or further evidence.
- **Step 2 (audio content variation):** Done. Speech-like audio now uses **project fixtures** (TTS/recorded speech): `tests/utils/audio-file-loader.js` loads `tests/fixtures/audio-samples/sample_<name>.json`, decodes base64 PCM, resamples 16k→24k; integration test sends 100ms of that. Real-API test "firm audio (speech-like audio)" uses fixture `hello`. Ran both real-API firm audio tests with **turn_detection: null**: **silence** and **speech-like (fixture)** both **passed** within 12s (single run). Recommendation: run N times and record pass rate for stronger evidence.
- **Step 4 (regardless):** NEXT-STEPS.md item A updated to reflect 0 errors (no relaxation).
