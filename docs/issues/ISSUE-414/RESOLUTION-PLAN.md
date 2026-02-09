# Issue #414: Resolution plan — "server had an error" (5s defect)

**Purpose:** Actionable plan to resolve the upstream "server had an error" defect. Written so a future implementer or reviewer can execute it without re-testing ruled-out paths or misreading progress as resolution.

---

## 1. Headline (read this first)

We **resolved** the **"buffer too small"** defect by disabling Server VAD (`turn_detection: null`) and the protocol changes in §2; that error is gone with our changes. The **5s "server had an error"** defect **remains unresolved.** This plan **focuses on that defect and on the idle-timeout hypothesis** as the root cause. Four TDD cycles proved the 5s error is not caused by session.update audio/VAD config. The real-API firm audio integration test uses a **12s** assertion window (so we are not racing the ~5s timeout); the 5s error may still persist in E2E. This document is the resolution plan for the remaining defect and the differential diagnosis.

---

## 2. What we fixed vs what remains broken

### Fixed (do not re-investigate)

- **"Buffer too small" (and dual-control race)** — This was the defect we resolved. With our changes, the **"buffer too small"** error is **gone**: it does not occur when Server VAD is disabled (`turn_detection: null`) and the rest of the protocol is in place (send format, proxy-only commit + `response.create`, audio gate). The same fix removed "conversation already has an active response." Protocol and integration tests confirm. It only reappears when we **re-enable** Server VAD (e.g. for the idle_timeout_ms experiment). See [CURRENT-UNDERSTANDING.md](./CURRENT-UNDERSTANDING.md) and [RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md](./RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md) for protocol and code locations.

### Remains broken (this plan targets only this)

- The generic **"server had an error"** (and sometimes connection close) — either right after append or ~5s after connection / after a successful turn. This plan targets that defect only.

---

## 3. Differential diagnosis

Use this table so the next person does not re-test ruled-out paths. **Complete and rule out each hypothesis here before moving to concurrency/rate-limiting/upstream.**

| Hypothesis | Tested? | Result / notes |
|------------|---------|----------------|
| Session.update audio/VAD config | Yes (4 TDD cycles) | Ruled out |
| idle_timeout_ms | **Not ruled out** | Cannot test without re-enabling Server VAD, which re-introduces "buffer too small" (dual-control race). API lookup: docs show `idle_timeout_ms`: null in effective session; **behavior when null is not documented** (Path A not satisfied). Hypothesis (5s error = idle timeout) remains plausible but unconfirmed. See §4 (Findings, §4.1 How we respond), §7 Step 1, [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.7. |
| Audio content/quality (silence vs speech) | Yes (5 runs) | **Ruled out.** Both variants (silence + speech-like fixture) passed 5/5 within 12s, turn_detection: null. See §5 "5-run pass rate" and firm-audio-5run-results.txt. |
| Connection concurrency / race conditions | No | E2E may open multiple connections or reconnect. **Defer until above rows are complete.** |
| Rate limiting / account-level throttling | No | OpenAI may throttle test accounts. Defer until concurrency considered. |
| Audio chunk size / framing | Partially | **Partially** = we use a single strategy (20ms chunks) and have not varied it. To fully test: run firm audio or E2E with different chunk sizes (e.g. 10ms, 40ms) or framing and record whether the 5s error appears. Until then we have not ruled in or out chunk size as a factor. |
| Upstream bug (no client-side fix) | Assumed fallback | No evidence from OpenAI support yet |

---

## 4. idle_timeout_ms: logical gap and why it is not ruled out

**Focus:** The remaining defect is the **5-second "server had an error"**. The leading hypothesis is that it is caused by an **idle timeout** (or similar server-side timeout). This section and Step 1 in §7 target that hypothesis.

### The variable and its default

- **Variable:** `idle_timeout_ms` — under `session.audio.input.turn_detection` when `type` is `server_vad`. Optional numeric (milliseconds). See [session.updated](https://platform.openai.com/docs/api-reference/realtime-server-events/session/updated) / [session.created](https://platform.openai.com/docs/api-reference/realtime-server-events/session/created) for the effective session shape.
- **Documented default and behavior when null:** See **[scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.7** for the OpenAI API citation and the looked-up detail. In short: the API reference example (session.created / session.updated) shows **`idle_timeout_ms`: null** in the effective session; the docs **do not** state what the server does when `idle_timeout_ms` is null (e.g. whether an internal default applies). If the server applies an implicit ~5s default when null — or when VAD is disabled — that would align with the observed ~5s "server had an error".

### Logical gap

We send `turn_detection: null`, so we explicitly **disable** Server VAD. If VAD is disabled, an "idle timeout" from VAD may not apply — or the server may still run a **separate** timeout (e.g. ~5s) that we cannot configure when VAD is off. The hypothesis: the 5s "server had an error" might be that separate timeout or the server’s behavior when `idle_timeout_ms` is null.

### Why we have not ruled it out

We ran **one** experiment: send `turn_detection: { type: 'server_vad', idle_timeout_ms: 30000, create_response: false }` to see if a long idle timeout would eliminate the 5s error. In that run we **never observed the 5s error** — we hit **"buffer too small"** first, because enabling Server VAD re-introduces the dual-control race (server commits/consumes buffer before our proxy). So the experiment did not answer: "Is the 5s error caused by an idle timeout?" It only showed that we cannot safely enable server_vad to *test* that question. Ruling out idle_timeout_ms would require one of:

- **A.** Official API/docs stating that with `turn_detection: null` there is no server-side idle timeout, or that the 5s error is unrelated to timeout.
- **B.** A way to extend or disable a server-side timeout **without** enabling Server VAD (if the API ever supports it).
- **C.** Explicitly documenting "idle_timeout_ms not ruled out: cannot test without re-introducing buffer-too-small" and treating it as an open hypothesis when escalating upstream.

### Findings (API lookup)

We looked up the [OpenAI Realtime API](https://platform.openai.com/docs/api-reference/realtime-server-events/session/created) (session.created / session.updated and VAD guide). **Finding:** The effective-session example shows **`idle_timeout_ms`: null** in `turn_detection`. The API reference and [VAD guide](https://platform.openai.com/docs/guides/realtime-vad) **do not** state what the server does when `idle_timeout_ms` is null (e.g. whether an internal default applies, or timeout is disabled). So **Path A is not satisfied** — we have no official confirmation that with `turn_detection: null` there is no server-side idle timeout, or that the 5s error is unrelated. The ~5s timing remains consistent with an undocumented default. Full citation and wording: [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.7.

### Implementation note (for any repeat experiment)

- **File:** [scripts/openai-proxy/translator.ts](../../../scripts/openai-proxy/translator.ts) — `mapSettingsToSessionUpdate` uses **Settings.agent.idleTimeoutMs** (shared with component) for `idle_timeout_ms` in session.update. No separate env var.
- The type `OpenAISessionUpdate` already allows a `turn_detection` object (see interface around line 33).

---

## 4.1 How we respond (recommended)

Given the API lookup result (behavior when `idle_timeout_ms` is null not documented, Path A not satisfied), we recommend:

1. **Close Step 1 via Path B** — Document in §3 that **idle_timeout_ms is not ruled out**: we cannot test it without re-enabling Server VAD, which re-introduces the "buffer too small" dual-control race. Update the table and §10 progress log so Step 1 is marked complete with that outcome.
2. **Document the finding** — Keep PROTOCOL-AND-MESSAGE-ORDERING.md §3.7 and this plan as the record: docs show null, behavior when null unspecified; 5s error hypothesis remains plausible but unconfirmed.
3. **Optional: ask OpenAI** — If you have a support channel or community forum access, ask: (a) What does the server do when `idle_timeout_ms` is null in the effective session? (b) When `turn_detection` is null (Server VAD disabled), is there a server-side idle or connection timeout that can cause "server had an error" after ~5s, and can it be configured or disabled? Include the PROTOCOL §3.7 citation and our observation (5s error with turn_detection: null; firm audio 5/5 in integration; E2E still flaky).
4. **Proceed to Step 5** — With idle_timeout_ms recorded as "not ruled out," move to concurrency / rate limiting investigation or upstream escalation. If escalating, include in the evidence: idle_timeout hypothesis uncrossed (docs don’t specify null behavior); buffer-too-small resolved; firm audio 5/5; E2E policy 0 errors.

---

## 5. Firm audio test: what it proves and what it doesn’t

### What it proves

With the current protocol, the real-API integration test **"Issue #414 real-API: firm audio connection — no Error from upstream within 12s after sending audio"** (in [tests/integration/openai-proxy-integration.test.ts](../../../tests/integration/openai-proxy-integration.test.ts)) can pass: no Error from upstream within **12 seconds** after sending audio in that scenario. The assertion window is set at **12 seconds** so the test is not racing the ~5s timeout.

### What it doesn’t

1. **Single pass is weak evidence** — Document pass rate across N runs (e.g. 5 or 10) when reporting results.
2. **Flaky upstream** — Passing sometimes and failing in E2E is consistent with flaky upstream behavior, not a resolved defect.

### 5-run pass rate (2025-02-09)

- **Command (tee for review):**  
  `(for i in 1 2 3 4 5; do echo "=== Run $i ==="; USE_REAL_OPENAI=1 npx jest tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #414 real-API: firm audio" --forceExit --silent 2>&1 | tail -5; done) 2>&1 | tee docs/issues/ISSUE-414/firm-audio-5run-results.txt`
- **Result:** 5/5 runs passed (2 tests per run: firm audio silence + firm audio speech-like). Raw output: [firm-audio-5run-results.txt](./firm-audio-5run-results.txt).
- **Conclusion:** Under `turn_detection: null`, the firm audio integration test is 5/5 over N runs; single-run evidence is strengthened. E2E may still show flaky upstream behavior.

---

## 6. E2E policy (reconcile with critique)

**E2E policy: 0 agent errors.** No relaxation for error count. Content relaxations (Repro 9/10, connect-only chunks >= 0) do not allow errors; they relax response shape or greeting TTS expectations.

- **Current code:** [test-app/tests/e2e/helpers/test-helpers.js](../../../test-app/tests/e2e/helpers/test-helpers.js) — `assertNoRecoverableAgentErrors(page)` has no second argument; all calls require 0 errors.
- **E2E-RELAXATIONS-EXPLAINED.md** states "Allow 1 error" was **UNDONE**.
- **Stale wording:** [NEXT-STEPS.md](./NEXT-STEPS.md) §1 item A still describes "allow up to 1 recoverable error" for test 5 when USE_REAL_APIS=1. That wording is stale and should be corrected in a separate update so it matches current behavior (0 errors).

---

## 7. Ordered resolution steps (elaborate plans)

Complete steps in order. Do not move to concurrency/rate-limiting/upstream until the differential table (§3) hypotheses that can be tested are resolved.

---

### Step 1: idle_timeout_ms — **DONE (Path B)**

**Goal:** Either rule out "server-side idle timeout causes the 5s error" or document that we cannot rule it out and why.

**Outcome:** We closed Step 1 via **Path B**. API lookup found that the docs show `idle_timeout_ms`: null in the effective session but **do not state behavior when null** (Path A not satisfied). We cannot safely test with Server VAD on (buffer-too-small returns). Table §3 now shows "Not ruled out" with citation; §10 progress log updated.

**What we did:**

- Implemented gated experiment; ran with `OPENAI_REALTIME_IDLE_TIMEOUT_MS=30000` → "buffer too small" (dual-control race).
- Looked up OpenAI Realtime API (session.created/updated, VAD guide); recorded finding in PROTOCOL-AND-MESSAGE-ORDERING.md §3.7 and §4 "Findings (API lookup)."
- Documented "Not ruled out" in §3; added §4.1 "How we respond"; updated §10.

**Next:** See §4.1 for recommended response (optional: ask OpenAI; proceed to Step 5).

---

### Step 2: Audio content/quality (silence vs speech) — **DONE**

**Goal:** Rule out "audio content (silence vs speech-like) causes the 5s error" by varying content and running multiple times.

**Done criterion:** Table §3 shows "Ruled out" with N-run pass rate.

**What we did:** Introduced speech-like fixture (tests/fixtures/audio-samples), ran both firm audio tests (silence + speech-like) with `turn_detection: null`, then ran 5 times with output teed to `firm-audio-5run-results.txt`. 5/5 passed. Table updated to "Yes (5 runs), Ruled out."

---

### Step 3: Audio chunk size / framing — **NOT DONE** (optional before concurrency)

**Goal:** Move "Audio chunk size / framing" from "Partially" to either "Ruled out" or "Tested: …" with a clear result.

**Done criterion:** Table §3 notes either (a) varied chunk size/framing with no correlation to 5s error, or (b) limited test (e.g. 20ms only) and explicitly "not varied; accept risk" so we can proceed.

**Plan:**

1. Identify where chunk size/framing is set (integration test and/or proxy). Document current behaviour (e.g. 20ms chunks).
2. Either: (A) Run firm audio (or E2E) with at least one other chunk size (e.g. 10ms or 40ms) and record pass/fail and any 5s error; or (B) Document "single strategy only; not varied" and leave as "Partially" with a one-line note that we proceed to concurrency with that caveat.
3. Update §3 and §10 accordingly.

---

### Step 4: Regardless — NEXT-STEPS.md and evidence

**Goal:** NEXT-STEPS.md §1 item A matches actual E2E policy (0 errors). Optionally add firm audio N-run evidence.

**What we did:** NEXT-STEPS.md item A updated to reflect 0 errors (no relaxation). Optional: add short "Evidence" subsection with firm audio 5-run result and link to firm-audio-5run-results.txt.

---

### Step 5: Connection concurrency / rate limiting / upstream — **DEFERRED**

**Goal:** After §3 rows for idle_timeout_ms and (if desired) chunk size are complete, investigate concurrency, rate limiting, or escalate as upstream bug with evidence.

**Plan:** See §3 table: "Connection concurrency" and "Rate limiting" remain "No" until Steps 1 and 3 (as chosen) are done. Then: design tests or runs (e.g. single vs multiple connections, spacing), record results, update table and progress log; or document evidence and escalate upstream (including "idle_timeout_ms not ruled out" if Path B was chosen in Step 1).

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
- **Passing vs failing tests and 10s experiment:** [PASSING-VS-FAILING-TESTS-THEORY.md](./PASSING-VS-FAILING-TESTS-THEORY.md).

---

## 10. Progress log (step-wise updates)

- **Plan updates:** Firm audio assertion window set to **12s** (not 5s). Audio content (real speech vs silence) marked **critical** to vary. Doc consolidation: **definitely** consolidate to 3 docs. Differential table (§3) and step plans (§7) expanded: complete table before concurrency/upstream; Step 1 and chunk size clarified; Step 1 **not** considered done.
- **Step 1 (idle_timeout_ms):** **Complete (Path B).** Implemented gated experiment; ran with `OPENAI_REALTIME_IDLE_TIMEOUT_MS=30000` → "buffer too small" (dual-control race); 5s error not observed in that run. **API lookup:** Checked OpenAI Realtime API (session.created/updated, VAD guide). Finding: effective session example has `idle_timeout_ms`: null; **docs do not state what the server does when null**. Path A not satisfied. **Outcome:** Step 1 closed via Path B — idle_timeout_ms **not ruled out** (cannot test without re-introducing buffer-too-small). Table §3 and §4 updated. See §4 "Findings (API lookup)" and §4.1 "How we respond"; [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.7.
- **Step 2 (audio content variation):** Done. Speech-like audio uses project fixtures; both firm audio tests (silence + speech-like) passed. **Step 2 follow-up (5-run pass rate):** 5/5 runs passed; output in `firm-audio-5run-results.txt`. Table §3: Audio content/quality **Ruled out**.
- **Step 3 (chunk size / framing):** Not done. Table §3: "Partially" — 20ms only; not varied. Optional before Step 5. See §7 Step 3.
- **Step 4 (regardless):** NEXT-STEPS.md item A updated to reflect 0 errors (no relaxation).
- **Step 5 (concurrency / rate limiting / upstream):** Deferred until Step 1 (and optionally Step 3) complete. See §3 and §7 Step 5.
- **Idle timeout shared:** Proxy uses **Settings.agent.idleTimeoutMs** (component sends it; default 10s). No OPENAI_REALTIME_IDLE_TIMEOUT_MS. Greeting flow passes with default Settings. See PROTOCOL-AND-MESSAGE-ORDERING.md §3.9 and NEXT-STEPS.md "Where we are."
