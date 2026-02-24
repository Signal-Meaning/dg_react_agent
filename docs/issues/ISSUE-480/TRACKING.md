# Issue #480 – Tracking (TDD)

**GitHub:** [#480](https://github.com/Signal-Meaning/dg_react_agent/issues/480)

---

## TDD workflow

1. **RED:** Write failing test first.
2. **GREEN:** Minimal implementation to make test pass.
3. **REFACTOR:** Improve code, keep tests green.

---

## Steps

### 1. RED – Real-API integration test (done)

- **Test added:** `tests/integration/openai-proxy-integration.test.ts`
  - `(useRealAPIs ? it : it.skip)('Issue #480 real-API: Settings with context.messages + follow-up yields contextualized response (USE_REAL_APIS=1)', ...)`
- **Scenario:** Send Settings with `agent.context.messages` (user: "Remember my favorite color is blue.", assistant: "I'll remember that your favorite color is blue."). After SettingsApplied, send InjectUserMessage "What is my favorite color?". Assert: no Error, assistant ConversationText content includes "blue".
- **When run with mock:** Test is skipped (useRealAPIs false).
- **When run with real API:** `USE_REAL_APIS=1 OPENAI_API_KEY=... npm test -- tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #480 real-API"` — expect **failure** (model ignores context, response does not contain "blue") until proxy is fixed.

### 2. GREEN – Fix proxy

- **Real-API run (this repo):** With `USE_REAL_APIS=1` and `OPENAI_API_KEY`, the Issue #480 real-API test **passed** (response included "blue"). So in this environment the proxy + real API appear to use context.
- **Voice-commerce:** They still see the model ignoring prior context. So either (a) context is not reaching the proxy in their setup (e.g. Settings shape or timing), or (b) different model/instructions/region, or (c) need WebSocket trace to compare. No proxy code change was required to get GREEN locally; next step is to get a trace from voice-commerce or reproduce in a scenario that matches theirs.

### 3. REFACTOR

- No proxy code change; mock and real-API tests pass. Docs updated with real-API result and next steps for voice-commerce (trace / reproduce).

---

## Commands

```bash
# Mock only (CI); Issue #480 real-API test is skipped
npm test -- tests/integration/openai-proxy-integration.test.ts

# Real API (RED then GREEN); requires OPENAI_API_KEY in .env or test-app/.env
USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #480 real-API"
```
