# Instructions E2E Test – What We’re Proposing (Issue #381)

This doc clarifies **what** the instructions E2E tests do, **why** they work for both Deepgram and OpenAI, and what **optional** test we might add.

---

## 1. Clarification: the instructions test is not “about files”

The existing instructions E2E lives in **`instructions-e2e.spec.js`**. It is **not** a “file” or “file upload” test. It tests the **instructions pipeline**:

- Instructions are **loaded** (the test-app may get them from env, a file path, or a default — that’s an app detail).
- Instructions are **shown** in the UI (Status, Preview, Source).
- Instructions are **passed to the voice agent** and the agent responds.

Because the test only asserts “instructions loaded, displayed, and used by the VA,” it does **not** depend on which VA provider is behind the connection. We **can** (and did) run the same spec for **Deepgram or OpenAI**: same tests, same assertions; backend is chosen by `VITE_OPENAI_PROXY_ENDPOINT`.

---

## 2. Why this test works for both Deepgram and OpenAI

- **Deepgram:** The component sends instructions in Settings (e.g. `agent.think.prompt`). Deepgram uses them for the session.
- **OpenAI:** The proxy maps Settings (e.g. `settings.agent?.think?.prompt`) to `session.instructions` in `session.update`. OpenAI uses session instructions for the model.

So both backends accept instructions; the test only checks that the app loads them, shows them, and that the VA receives them and responds. No file-specific or backend-specific behavior is required. The spec is already **backend-agnostic** (run with or without `VITE_OPENAI_PROXY_ENDPOINT`).

---

## 3. What’s the (optional) gap?

We **do** have an E2E that checks: instructions load, preview, and VA integration. We **don’t** yet have a test that asserts: “When we send a **specific** instruction (e.g. ‘answer with BANANA when asked favorite fruit’), does the agent’s **reply** actually contain that word?”

So the optional gap is: **no test that proves instructions are applied end-to-end by response content** (Settings → proxy → OpenAI/Deepgram → response text → UI).

---

## 4. What already exists (no new “feature” needed)

The path is already implemented:

1. **Test-app** passes `instructions: loadedInstructions` (or a fixed string) in `agentOptions` (e.g. in `App.tsx` around line 424).
2. **Component** builds Settings with `agent.think.prompt = currentAgentOptions.instructions` (DeepgramVoiceInteraction, ~line 1804).
3. **Proxy** maps `settings.agent?.think?.prompt` → `session.instructions` in `session.update` (translator `mapSettingsToSessionUpdate`).
4. **OpenAI** uses `session.instructions` for the model.

We are **not** proposing a new feature. We are proposing **one new E2E test** that **asserts** this path works by checking response **content**.

---

## 5. What we're proposing (the optional test only)

**One new E2E test** that:

1. **Connects** through the OpenAI proxy (same as existing tests: `setupTestPageWithOpenAIProxy`, or load app with proxy URL).
2. **Uses a fixed, detectable instruction** for this test only, e.g.  
   `"When the user asks what your favorite fruit is, you must respond with exactly the word BANANA and nothing else."`
3. **Sends one user message**, e.g. `"What is your favorite fruit?"` (via text input / injectUserMessage).
4. **Asserts** that the agent’s response text (in `[data-testid="agent-response"]` or equivalent) **contains** `"BANANA"` (or a similar keyword) within a timeout.

So: **same connection + message flow as existing tests**, but with **instructions set to a specific sentence** and an **assertion on response content**. That’s it.

---

## 6. Where does the optional test live?

- **Preferred:** Add one new test case inside **`openai-proxy-e2e.spec.js`** (e.g. “Instructions applied – agent response reflects instructions”), so all OpenAI proxy E2E stay in one place.
- **Alternative:** Small new spec `openai-instructions-e2e.spec.js` if you want instructions tested in isolation. Same idea; just a different file.

---

## 7. How do we get “instructions” set for this one test?

The test needs the **test-app** to send the detectable instruction **for this run only**. Options:

- **A. URL / query param**  
  If the test-app already supports something like `?instructions=...` or `?instructionOverride=...`, the test navigates to that URL and the app uses that as `agentOptions.instructions`.

- **B. Test-app default when running E2E**  
  If the test-app reads an env var (e.g. `VITE_E2E_INSTRUCTIONS`) and uses it when set, Playwright can set that env when running this spec; the test then uses the default instruction string.

- **C. No test-app change**  
  Use the **existing** default instructions (e.g. “You are a helpful voice assistant…”) and assert something that’s likely true under that default (e.g. response is non-empty and contains a few words). That’s a **weaker** test (doesn’t prove a specific instruction was applied), but still checks that “instructions path” doesn’t break. We can start with this and later tighten to a specific instruction (A or B) if you want a stronger test.

**Recommendation:** Prefer **A or B** so we assert a **specific** instruction (e.g. “say BANANA”) and get a real “instructions applied” guarantee. If the test-app has no param/env yet, add a minimal one (e.g. `VITE_E2E_INSTRUCTIONS` or a query param) used only when set.

---

## 8. TDD order (optional content-assertion test)

1. **RED**  
   - Add the test (in `openai-proxy-e2e.spec.js` or new spec): connect → send fixed instruction (via param/env or existing default) → send “What is your favorite fruit?” → assert response contains the expected keyword (e.g. `BANANA`).  
   - Run it. If the pipeline is correct, it may already **pass**. If not (e.g. proxy doesn’t map instructions, or test-app doesn’t pass them), it **fails** — that’s the RED phase.

2. **GREEN**  
   - Fix only what’s needed: e.g. ensure proxy sends `session.instructions` from `settings.agent.think.prompt`, and/or add minimal test-app support (param/env) so this test can set a specific instruction.  
   - Re-run until the test passes.

3. **REFACTOR**  
   - Clean up (names, timeouts, duplicate code). Keep the test in the suite.

---

## 9. One-sentence summary

**We are proposing a single E2E test that connects via the OpenAI proxy, sends a known instruction (e.g. “answer with BANANA when asked favorite fruit”), sends that user question, and asserts the agent’s reply contains the expected word — proving the instructions path end-to-end; implement it TDD (add test first, then fix if needed).**

**Implemented:** The test lives in **`instructions-e2e.spec.js`** as “response content reflects instructions when VITE_E2E_INSTRUCTIONS is set”. The test-app checks **`VITE_E2E_INSTRUCTIONS`** first when loading instructions; when set, that string is used. The test skips when the env is not set.

**Run the test (Option A – Playwright starts server):**

```bash
VITE_E2E_INSTRUCTIONS="When the user asks what your favorite fruit is, you must respond with exactly the word BANANA and nothing else." HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/instructions-e2e.spec.js --grep "response content reflects"
```

For Deepgram instead of OpenAI, omit `VITE_OPENAI_PROXY_ENDPOINT`. With a pre-started dev server, prefix with `E2E_USE_EXISTING_SERVER=1` and omit `HTTPS=0` if appropriate.

After this test is green, run the Suggested assortment (see E2E-PRIORITY-RUN-LIST.md).
