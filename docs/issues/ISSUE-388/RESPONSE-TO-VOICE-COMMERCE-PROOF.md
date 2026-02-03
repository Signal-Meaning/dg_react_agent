# Response to voice-commerce: “Component tests don’t cover upstream close”

**Context:** Customer wrote a proof document (e.g. `PROOF-COMPONENT-TESTS-DONT-COVER-UPSTREAM-CLOSE.md`) arguing that our test suite does not cover the “upstream closes after first message” scenario in a way that would turn red when the bug is present. This file is our official response.

---

## You’re correct on the facts

We’ve checked the repo and package and your reading is accurate.

1. **Repo `tests/` is not in the published package**  
   `package.json` `"files"` is `["dist", "README.md", "DEVELOPMENT.md", "docs/", "scripts/", "test-app/"]`. Root `tests/` is not included. So consumers who install `@signal-meaning/deepgram-voice-interaction-react@0.7.12` do **not** get:
   - `tests/issue-380-inject-upstream-close.test.tsx`
   - `tests/integration/openai-proxy-integration.test.ts`
   or any other files under repo root `tests/`. Those exist only in the source repo and in our CI.

2. **Test 4 is skipped**  
   In RESOLUTION-PLAN we state: “Tests 1–3 pass; test 4 (agent reply within 10 s with closing mock) is skipped until upstream keeps the connection open.” So the scenario “upstream closes, expect no reply within 10s” is **not** asserted by a test that runs. Tests 1–3 document component behavior (closed reported, no utterance when closed, utterance when we simulate reply); they do not go **red** if someone reverts the proxy fix.

3. **Resolution is defined by E2E in our environment**  
   We define “defect resolved” as: the E2E test `openai-inject-connection-stability.spec.js` (“should receive agent response after first text message (real OpenAI proxy)”) **passes** when run with a real OpenAI proxy. When the bug is present (upstream closes before reply), that same E2E **fails** (timeout). So we are **not** claiming “we have a unit test that fails when the bug is present.” We are claiming “we fixed the proxy and our E2E (and our integration test in CI) pass.” Our green tests do **not** contradict what you see in your environment; they only show that in our setup the canary E2E is green.

---

## What we do and don’t claim

- **We do not claim** that the published npm package contains tests that would turn red if the bug regressed in a consumer environment.
- **We do claim** that:
  - In the **source repo**, we have unit tests (1–3) that document component behavior (closed reported, no spurious utterance), and an **integration test** that would go red if the proxy sent `response.create` immediately (it asserts order and delay). That integration test runs in our CI and guards the proxy fix.
  - The **fix** is in the **proxy** (wait for `conversation.item.added` before `response.create`), not in the React component. The component was already behaving correctly (send message, report closed, only fire utterance when a reply is received).
- So: our “green tests” are consistent with your proof. They don’t contradict it.

---

## If you still see the issue on 0.7.12

The fix is **proxy-side**. We own the **proxy code** (OpenAI and Deepgram) in this repo and the integration contract; we deliver **component technology only** and do not host a production proxy service. Use a proxy that follows our **reference implementation** (correct ordering: `response.create` only after `conversation.item.added`). If you run your own proxy, it must follow the same ordering:

- On `InjectUserMessage`, send only `conversation.item.create` to the OpenAI Realtime API.
- Send `response.create` only **after** the upstream sends `conversation.item.added` or `conversation.item.done` for that item.

If a proxy sends `response.create` immediately after `conversation.item.create`, the upstream may still close with code 1000 before replying.

**References:**

- **OpenAI Realtime API / event order:** `docs/issues/ISSUE-388/OPENAI-REALTIME-API-REVIEW.md` (in repo and in the published `docs/` in the package).
- **Reference proxy implementation:** `scripts/openai-proxy/server.ts` in the repo (included in the package under `scripts/openai-proxy/`). Logic: set a flag on InjectUserMessage; send `response.create` only when upstream sends `conversation.item.added` or `conversation.item.done`.
- **Ownership decision:** We own proxy **code** and integration contract; see `docs/issues/ISSUE-388/PROXY-OWNERSHIP-DECISION.md`.

---

## Optional: clearer docs for consumers

We can add a short note to RESOLUTION-PLAN or README stating that:

- The unit/integration tests that cover upstream-close and proxy ordering live in the **source repo** only (root `tests/`) and are **not** included in the published package.
- Test 4 (“agent reply within 10 s with closing mock”) remains **skipped** by design.

That would make it explicit for future audits that the published package does not contain those tests and that resolution is demonstrated by E2E and by our CI (integration test in repo), not by a shipped unit test that fails when the bug is present.

---

**Summary:** Your proof is correct. We don’t ship the tests that would cover this in the package, and the “would fail when bug is present” unit test is skipped. Resolution is E2E + proxy fix. We own the proxy **code** and reference implementation; any proxy (yours or ours) must use the same ordering (response.create only after conversation.item.added). We’re happy to point to the reference implementation and docs.
