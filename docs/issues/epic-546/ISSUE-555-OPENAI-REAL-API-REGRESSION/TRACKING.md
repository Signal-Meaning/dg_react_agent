# Tracking — GitHub #555 (OpenAI proxy real-API integration regression)

**Issue:** [OpenAI proxy: real-API integration regressions (USE_REAL_APIS)](https://github.com/Signal-Meaning/dg_react_agent/issues/555)  
**Epic (parent):** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546) — registered as a **GitHub sub-issue** of the epic.

## Goal

Restore confidence in **`USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`** for release qualification: classify failures (repo vs OpenAI), fix or document, and close with evidence.

## TDD → PR merge (first things first)

**Policy:** Nothing is “done” for merge until the cycle is visible here: **🔴 RED → 🟢 GREEN → 🟡 REFACTOR (gold)** on the tests that define the behavior, **then** merge via PR. **Pre-release** (`USE_REAL_APIS` burn-in, bisect, packaging) is **after** this lane (or parallel only where your process explicitly allows).

| Step | Meaning | #555 (this workstream) |
|------|---------|-------------------------|
| 🔴 **RED** | Failing tests exist **before** or **as** the regression is fixed—they encode the required behavior and **must fail** until implementation catches up. | **Done (logged):** Pre-fix **`USE_REAL_APIS`** run showed Issue **#470** real-API **FAIL** (timeout, no assistant text after tool). **Automated RED coverage** added/updated: `tests/openai-proxy.test.ts` (e.g. §6b / `output_text.done` path), `tests/integration/openai-proxy-integration.test.ts` (mock upstream + Issue #555 fallback), test-app Jest on `/function-call` + Playwright **6**/**6b** token assertions. *If your bar is “run RED locally before green,” paste the failing command output into the verification log when you open the PR.* |
| 🟢 **GREEN** | Minimal implementation; **same tests pass** (mock + unit + integration **without** `USE_REAL_APIS` for proxy; test-app Jest + targeted E2E as scoped). | **Done (logged):** `npm test -- tests/openai-proxy.test.ts tests/integration/openai-proxy-integration.test.ts` **PASS**; test-app `npm test` **PASS**; Playwright **6**/**6b** **PASS** with `USE_REAL_APIS=1` for E2E (see log). |
| 🟡 **REFACTOR** | Improve design while **keeping tests green** (no behavior change). | **Open** — check when you complete an explicit refactor pass, or mark **N/A** and note why. |
| **Merged PR** | Fix lands on target branch with link + short root-cause note. | **Open** — fill PR URL when merged. |

**Checklist (copy to PR description if useful)**

- [x] 🔴 RED evidenced (failing test output and/or pre-fix real-API capture in verification log)
- [x] 🟢 GREEN evidenced (commands + PASS in verification log)
- [ ] 🟡 REFACTOR complete or N/A (brief note)
- [ ] PR merged (link)

## Pre-release / qualification (not a substitute for TDD)

Run **after** the TDD lane above is satisfied for merge (or per release policy **in addition** to it).

- [ ] **`USE_REAL_APIS=1`** — full file and/or `-t "Issue #470 real-API"` (ideally **3×**); log here. *(Pre-fix run failed #470; post-fix run not yet logged in this file.)*
- [ ] **Bisect / baseline** — compare to last known-good tag or branch; note “upstream flake” vs repo regression
- [ ] **`openai-proxy-run-ts-entrypoint.test.ts`** — green on the branch you are shipping
- [ ] **504 / gateway** — intermittent; document repeat runs if it blocks qualification

**Symptoms (for context)**

| Case | Failure mode |
|------|----------------|
| Issue #470 real-API | 60s timeout — no assistant `ConversationText` after function-call backend HTTP + `FunctionCallResponse` |
| `translates InjectUserMessage …` (real API) | 25s Jest timeout; upstream log **`Unexpected server response: 504`** on Realtime WebSocket |

## Definition of done

1. **TDD → PR:** Checklist under **TDD → PR merge** complete — 🔴 RED evidenced, 🟢 GREEN evidenced, 🟡 REFACTOR complete or **N/A** (with note), **merged PR** link filled in.  
2. **Pre-release (as needed):** Checklist under **Pre-release / qualification** ticked for the release you are cutting.  
3. **GitHub #555:** Mirror issue checkboxes; close with short root-cause note.

## Verification log

_Add dated entries (command, outcome, operator)._

### 2026-03-28 — Analysis started (agent)

**Commands**

- `npm test -- tests/integration/openai-proxy-integration.test.ts` (no `USE_REAL_APIS`) — **PASS** (69 passed, 15 skipped real-API cases). Confirms mock qualification path and in-process `createOpenAIProxyServer` + mock upstream are healthy on current tree.

**Failure anatomy (from issue + code review)**

1. **`Unexpected server response: 504` (InjectUserMessage → ConversationText, real API)**  
   - The `ws` client used for the **proxy → OpenAI** leg throws this when the HTTP upgrade gets a non-101 status (here 504).  
   - In `server.ts`, `upstream.on('error')` logs OTel ERROR with the message and calls `clientWs.close()` — see ```307:327:packages/voice-agent-backend/scripts/openai-proxy/server.ts```.  
   - The test ```1732:1776:tests/integration/openai-proxy-integration.test.ts``` only completes `done()` after assistant `ConversationText`; if the upstream handshake never completes, the client may never reach that state → **25s Jest timeout**.  
   - **Working hypothesis:** infrastructure / gateway flake at OpenAI (or path to `api.openai.com`), not a change in `server.ts` from EPIC-546. **Still needs:** repeat runs + optional bisect to rule out dependency (`ws`, Node) or env differences.

2. **Issue #470 real-API function-call timeout (~60s)**  
   - Flow: Settings (tools; **no** forced `outputModalities`) → `InjectUserMessage` → `FunctionCallRequest` → real `POST /function-call` → `FunctionCallResponse` → wait for assistant `ConversationText` containing the **`e2eVerify` token** from the tool JSON (opaque string, not natural-language time).  
   - Timeout with message “no assistant … after function call” means no qualifying assistant text after FCR within the deadline, or a **test harness** issue (e.g. `fetch`/WebSocket microtask ordering — see file header comment in `openai-proxy-integration.test.ts`).  
   - **Note:** A prior revision used `outputModalities: ['text']` and substring `12:00`/`UTC`; that is **no longer** the qualification shape.

**Recommended next steps (for bisect / qualification)**

- Run `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` **3×** on a clean shell; record which tests fail and whether 504 reproduces.  
- **Bisect** between last tag/commit known green for this suite and `HEAD` (or `release/v0.10.6`): if failures occur on old commits too → document **upstream / network exception**; if only on newer commits → hunt **repo** changes (deps, test expectations, env).  
- If (470) fails with assistant text present but without the `e2eVerify` token, the model did not follow instructions to copy the tool field; re-run or tighten the prompt. If the token never appears in tool JSON, check the minimal HTTP backend and `FunctionCallResponse` payload.

### 2026-03-28 — Full real-API openai-proxy-integration run (agent)

**Command:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`  
**Outcome:** **1 failed**, **19 passed** (real-API + shared tests that still run), **64 skipped** (mock-only), ~126s.

| Result | Test |
|--------|------|
| **FAIL** | `Issue #470 real-API: function-call flow completes without conversation_already_has_active_response` — **60s timeout**, message `Timeout waiting for assistant response after function call` (no `errorsReceived` appended to message → likely no `conversation_already_has_active_response` Error; assistant text after `FunctionCallResponse` never satisfied the test within 60s). |
| PASS | All other executed real-API cases, including: `#489` SettingsApplied; `#534` / `#537`; `#462` audio.done vs text.done; `#470` Req 1 & Req 3; `#489` InjectUserMessage + AgentAudioDone; **`translates InjectUserMessage … ConversationText` (~6.4s)** — **no 504** this run; `#414` firm audio ×2; `#489` post–FunctionCallResponse AgentAudioDone; `#480` context; `#414` greeting; `#489` AgentStartedSpeaking ordering. |
| SKIP | `#539` (no managed prompt id env); mock-only cases as expected. |

**Regression scope:** Within this file, **only the Issue #470 function-call + real HTTP backend path** failed; **no additional real-API failures** compared to the rest of the suite on this run. The **504 / InjectUserMessage** symptom from earlier reports **did not reproduce** here (treat as **intermittent upstream/network** until more runs).

### 2026-03-28 — Proxy fix for post-tool assistant text (Issue #555)

**Change:** OpenAI Realtime may deliver the **final assistant string** only on `response.output_text.done` (with no mappable `conversation.item.*` for that text) after `function_call_output`. The proxy previously treated `output_text.done` as control-only, so the Issue #470 real-API test never saw `ConversationText` after `FunctionCallResponse`.

**Implementation:** `extractAssistantTextFromResponseOutputTextDone` in `translator.ts`; in `server.ts`, on `response.output_text.done`, emit `ConversationText` (assistant) when extractable text exists and no assistant text was emitted yet for the response; dedupe when the same string arrives again on `conversation.item.done` (mock sends both). `AgentStartedSpeaking` is sent before the fallback (#482 order). Unit tests in `tests/openai-proxy.test.ts` (6b); integration mock test renamed/updated for Issue #555 fallback.

**Verification:** `npm test -- tests/openai-proxy.test.ts tests/integration/openai-proxy-integration.test.ts` — PASS. Targeted real-API run may still hit **504** or timeout when OpenAI is flaky; re-run `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts -t "Issue #470 real-API: function-call flow"` when the gateway is stable.

### 2026-03-28 — test-app E2E parity with Issue #470 `e2eVerify` contract

**Intent:** OpenAI-proxy Playwright tests **6** and **6b** qualify function-call execution with the **same opaque token** as integration Issue #470 (`dg-openai-proxy-fc-e2e-v1`), not a loose time/UTC substring match.

**Implementation (summary)**

- `test-app/scripts/function-call-handlers.js` — `get_current_time` result JSON includes **`e2eVerify`** (exported token constant; keep in sync with `tests/integration/openai-proxy-integration.test.ts`).
- `openai-proxy-e2e.spec.js` — `setupTestPageForBackend` adds **`fc-e2e-verify=true`**; after `waitForFunctionCall`, assert **`toContainText`** for the token on `[data-testid="agent-response"]`. Test **6d** uses the same query flag for a consistent Settings/instructions path (diagnostics unchanged).
- `test-app/src/App.tsx` — when **`fc-e2e-verify`** and **`enable-function-calling`** are true, append instructions that **spell the literal token twice** and forbid timestamps/UUIDs as substitutes. (A weaker “copy the e2eVerify field” line caused the model to invent values such as `e2eVerify:21:33:48`.)
- Jest: `test-app` `function-call-endpoint-integration` / `backend-integration` assert `parsed.e2eVerify` on `/function-call` responses. Docs: `test-app/tests/e2e/README.md` (function-call bullet), `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md` (optional test-app-only fields).

**Command (agent run)**

- From `test-app`: `USE_REAL_APIS=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6. Simple function calling|6b. Issue #462"` — **PASS** (2 passed).

- _Further dated runs: add below._
